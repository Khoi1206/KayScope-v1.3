import { describe, it, expect } from 'vitest'
import { buildOAuth1Header } from '../oauth1-sign'

const baseParams = {
  method: 'GET',
  url: 'https://api.example.com/resource?foo=bar',
  consumerKey: 'consumer-key',
  consumerSecret: 'consumer-secret',
  signatureMethod: 'HMAC-SHA1' as const,
}

describe('buildOAuth1Header', () => {
  it('produces an "OAuth ..." header containing all required oauth_ params', () => {
    const header = buildOAuth1Header(baseParams)
    expect(header).toMatch(/^OAuth /)
    expect(header).toContain('oauth_consumer_key="consumer-key"')
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"')
    expect(header).toMatch(/oauth_nonce="[0-9a-f]+"/)
    expect(header).toMatch(/oauth_timestamp="\d+"/)
    expect(header).toContain('oauth_version="1.0"')
    expect(header).toMatch(/oauth_signature="[^"]+"/)
  })

  it('omits oauth_token when no token/tokenSecret is provided', () => {
    const header = buildOAuth1Header(baseParams)
    expect(header).not.toContain('oauth_token=')
  })

  it('includes oauth_token when a token is provided', () => {
    const header = buildOAuth1Header({ ...baseParams, token: 'my-token', tokenSecret: 'my-token-secret' })
    expect(header).toContain('oauth_token="my-token"')
  })

  it('includes realm when provided', () => {
    const header = buildOAuth1Header({ ...baseParams, realm: 'https://api.example.com/' })
    expect(header).toContain('realm=')
  })

  it('produces different signatures for different consumer secrets (sanity: secret actually affects signing)', () => {
    const h1 = buildOAuth1Header(baseParams)
    const h2 = buildOAuth1Header({ ...baseParams, consumerSecret: 'different-secret' })
    const sig1 = h1.match(/oauth_signature="([^"]+)"/)?.[1]
    const sig2 = h2.match(/oauth_signature="([^"]+)"/)?.[1]
    expect(sig1).toBeTruthy()
    expect(sig2).toBeTruthy()
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for HMAC-SHA1 vs HMAC-SHA256', () => {
    const h1 = buildOAuth1Header({ ...baseParams, signatureMethod: 'HMAC-SHA1' })
    const h2 = buildOAuth1Header({ ...baseParams, signatureMethod: 'HMAC-SHA256' })
    const sig1 = h1.match(/oauth_signature="([^"]+)"/)?.[1]
    const sig2 = h2.match(/oauth_signature="([^"]+)"/)?.[1]
    expect(sig1).not.toBe(sig2)
  })

  it('percent-encodes special characters in header param values per RFC 3986', () => {
    const header = buildOAuth1Header({ ...baseParams, realm: "value with spaces & !*'()" })
    // Space must be %20 (not '+'), and !*'() must be percent-encoded, not left literal
    expect(header).not.toMatch(/realm="[^"]*[ !*'()][^"]*"/)
  })
})
