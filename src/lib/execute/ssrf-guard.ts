import { lookup } from 'node:dns/promises'

// ── SSRF Guard ─────────────────────────────────────────────────────────────

const BLOCKED_CIDRS = [
  // Loopback
  /^127\./,
  /^::1$/,
  // Private ranges
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  /^fe80:/i,
  // IMDS / cloud metadata
  /^169\.254\.169\.254$/,
  // IPv6 private
  /^fc/i,
  /^fd/i,
  // Unspecified / broadcast
  /^0\.0\.0\.0$/,
  /^255\.255\.255\.255$/,
]

export interface ISsrfGuard {
  assertSafe(url: string): Promise<void>
}

export class SsrfGuard implements ISsrfGuard {
  private readonly maxRedirects: number

  constructor(maxRedirects = 5) {
    this.maxRedirects = maxRedirects
  }

  /** Throw if the URL resolves to a blocked address. */
  async assertSafe(rawUrl: string): Promise<void> {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new Error(`SSRF guard: invalid URL "${rawUrl}"`)
    }

    // Only allow http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`SSRF guard: disallowed protocol "${url.protocol}"`)
    }

    const hostname = url.hostname

    // Direct IP check
    if (this.isBlockedIp(hostname)) {
      throw new Error(`SSRF guard: blocked address "${hostname}"`)
    }

    // DNS resolution check
    try {
      const addresses = await lookup(hostname, { all: true })
      for (const addr of addresses) {
        if (this.isBlockedIp(addr.address)) {
          throw new Error(`SSRF guard: "${hostname}" resolves to blocked address "${addr.address}"`)
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('SSRF guard:')) throw err
      // DNS failure — block by default (fail-closed)
      throw new Error(`SSRF guard: DNS lookup failed for "${hostname}"`)
    }
  }

  /** Validate a redirect URL during HTTP request execution. */
  async assertRedirectSafe(location: string, originalUrl: string): Promise<void> {
    // Resolve relative redirects against the original URL
    let resolved: string
    try {
      resolved = new URL(location, originalUrl).href
    } catch {
      throw new Error(`SSRF guard: invalid redirect location "${location}"`)
    }
    await this.assertSafe(resolved)
  }

  private isBlockedIp(ip: string): boolean {
    return BLOCKED_CIDRS.some(re => re.test(ip))
  }
}

export const ssrfGuard = new SsrfGuard()
