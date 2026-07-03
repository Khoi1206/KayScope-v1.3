import { fetch, Headers, FormData, Agent } from 'undici'
import { SsrfGuard } from './ssrf-guard'

// ── Types ──────────────────────────────────────────────────────────────────

export interface HttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string | Buffer | FormData | null
  /** Request timeout in ms (default: 30 000) */
  timeout?: number
  /** Whether to follow redirects (default: true) */
  followRedirects?: boolean
  /** Max number of redirects to follow (default: 10) */
  maxRedirects?: number
  /** Verify TLS certificates (default: true) */
  sslVerify?: boolean
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  /** Response size in bytes (before size cap) */
  size: number
  /** Total duration from first send to body fully read, in ms */
  durationMs: number
  /** Time from final request send to response headers received (actual TTFB), in ms */
  ttfbMs: number
  /** Time from headers received to body fully downloaded, in ms */
  downloadMs: number
  /** When true, body is a base64-encoded binary payload */
  isBinary: boolean
  /** Raw Set-Cookie header values (one entry per cookie) */
  setCookies: string[]
}

export interface IHttpClient {
  send(req: HttpRequest): Promise<HttpResponse>
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_REDIRECTS = 10

const STATUS_TEXTS: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 102: 'Processing',
  200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'Non-Authoritative Information',
  204: 'No Content', 205: 'Reset Content', 206: 'Partial Content', 207: 'Multi-Status',
  301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified',
  307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable',
  408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required',
  412: 'Precondition Failed', 413: 'Payload Too Large', 414: 'URI Too Long',
  415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 423: 'Locked',
  429: 'Too Many Requests', 451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
}

function isBinaryContentType(ct: string): boolean {
  const lower = (ct.split(';')[0]?.trim() ?? '').toLowerCase()
  return (
    lower.startsWith('image/') ||
    lower.startsWith('video/') ||
    lower.startsWith('audio/') ||
    lower.startsWith('font/') ||
    lower === 'application/pdf' ||
    lower === 'application/octet-stream' ||
    lower === 'application/zip' ||
    lower === 'application/gzip' ||
    lower === 'application/x-tar' ||
    lower === 'application/x-bzip2' ||
    lower === 'application/x-7z-compressed' ||
    lower === 'application/x-rar-compressed' ||
    lower === 'application/wasm'
  )
}

// ── UndiciHttpClient ───────────────────────────────────────────────────────

// Shared dispatcher reused across requests that opt out of TLS verification.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })

export class UndiciHttpClient implements IHttpClient {
  private readonly ssrf: SsrfGuard

  constructor(ssrf = new SsrfGuard()) {
    this.ssrf = ssrf
  }

  async send(req: HttpRequest): Promise<HttpResponse> {
    await this.ssrf.assertSafe(req.url)

    const timeoutMs = req.timeout ?? DEFAULT_TIMEOUT_MS
    const follow = req.followRedirects !== false
    const maxRedirects = follow ? (req.maxRedirects ?? DEFAULT_MAX_REDIRECTS) : 0
    const dispatcher = req.sslVerify === false ? insecureAgent : undefined

    const overallStart = Date.now()
    let currentUrl = req.url
    let method = req.method
    let redirectCount = 0

    while (true) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const hopStart = Date.now()
      let response: Awaited<ReturnType<typeof fetch>>
      try {
        response = await fetch(currentUrl, {
          method,
          headers: new Headers(req.headers),
          body: req.body ?? undefined,
          redirect: 'manual',
          signal: controller.signal,
          ...(dispatcher ? { dispatcher } : {}),
        })
      } finally {
        clearTimeout(timer)
      }

      // Time to first byte = time from this hop's start to headers received
      const ttfbMs = Date.now() - hopStart

      // Redirect handling (manual, with SSRF check on each hop)
      if (response.status >= 301 && response.status <= 308) {
        const location = response.headers.get('location')
        if (location && redirectCount < maxRedirects) {
          redirectCount++
          const resolved = new URL(location, currentUrl).href
          await this.ssrf.assertRedirectSafe(resolved, currentUrl)
          if (response.status === 303 || (method !== 'GET' && (response.status === 301 || response.status === 302))) {
            method = 'GET'
          }
          currentUrl = resolved
          continue
        }
        // No more redirects — fall through and return final response
      }

      return this.readResponse(response, overallStart, ttfbMs)
    }
  }

  private async readResponse(
    response: Awaited<ReturnType<typeof fetch>>,
    overallStart: number,
    ttfbMs: number,
  ): Promise<HttpResponse> {
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : []

    const downloadStart = Date.now()
    const buffer = await response.arrayBuffer()
    const downloadMs = Date.now() - downloadStart
    const durationMs = Date.now() - overallStart

    const capped = buffer.byteLength > MAX_BODY_BYTES ? buffer.slice(0, MAX_BODY_BYTES) : buffer
    const contentType = responseHeaders['content-type'] ?? ''
    const binary = isBinaryContentType(contentType)

    let body: string
    if (binary) {
      body = Buffer.from(new Uint8Array(capped)).toString('base64')
    } else {
      body = new TextDecoder('utf-8', { fatal: false }).decode(capped)
    }

    return {
      status: response.status,
      statusText: STATUS_TEXTS[response.status] ?? response.statusText ?? '',
      headers: responseHeaders,
      body,
      size: buffer.byteLength,
      durationMs,
      ttfbMs,
      downloadMs,
      isBinary: binary,
      setCookies,
    }
  }
}

export const httpClient = new UndiciHttpClient()
