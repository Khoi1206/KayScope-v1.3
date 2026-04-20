import { fetch, Headers, FormData } from 'undici'
import { SsrfGuard } from './ssrf-guard'

// ── Types ──────────────────────────────────────────────────────────────────

export interface HttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string | Buffer | FormData | null
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  /** Response size in bytes */
  size: number
  /** Total duration from send to fully read body, in ms */
  durationMs: number
}

export interface IHttpClient {
  send(req: HttpRequest): Promise<HttpResponse>
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB
const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 10

// ── UndiciHttpClient ───────────────────────────────────────────────────────

export class UndiciHttpClient implements IHttpClient {
  private readonly ssrf: SsrfGuard

  constructor(ssrf = new SsrfGuard()) {
    this.ssrf = ssrf
  }

  async send(req: HttpRequest): Promise<HttpResponse> {
    await this.ssrf.assertSafe(req.url)

    const start = Date.now()
    let currentUrl = req.url
    let redirectCount = 0

    while (true) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      let response: Awaited<ReturnType<typeof fetch>>
      try {
        response = await fetch(currentUrl, {
          method: req.method,
          headers: new Headers(req.headers),
          body: req.body ?? undefined,
          redirect: 'manual',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      // Handle redirects manually (to run SSRF check on each hop)
      if (response.status >= 301 && response.status <= 308) {
        const location = response.headers.get('location')
        if (!location || redirectCount >= MAX_REDIRECTS) {
          // No more redirects — return final response
          return this.readResponse(response, start)
        }
        redirectCount++
        const resolved = new URL(location, currentUrl).href
        await this.ssrf.assertRedirectSafe(resolved, currentUrl)
        // 303 always changes method to GET
        if (response.status === 303) {
          req = { ...req, method: 'GET', body: null }
        }
        currentUrl = resolved
        continue
      }

      return this.readResponse(response, start)
    }
  }

  private async readResponse(
    response: Awaited<ReturnType<typeof fetch>>,
    start: number
  ): Promise<HttpResponse> {
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // Read body with size cap
    const buffer = await response.arrayBuffer()
    const durationMs = Date.now() - start

    const capped = buffer.byteLength > MAX_BODY_BYTES
      ? buffer.slice(0, MAX_BODY_BYTES)
      : buffer

    const body = new TextDecoder('utf-8', { fatal: false }).decode(capped)

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body,
      size: buffer.byteLength,
      durationMs,
    }
  }
}

export const httpClient = new UndiciHttpClient()
