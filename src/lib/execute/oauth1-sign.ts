import { createHmac, randomBytes } from 'crypto'

export interface OAuth1SignParams {
  method: string
  /** Full request URL, including query string — query params are folded into the signed param set per spec, not left in the base-string URL component. */
  url: string
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
  signatureMethod: 'HMAC-SHA1' | 'HMAC-SHA256'
  realm?: string
  /**
   * Body params to include in the signature base string — only meaningful for
   * x-www-form-urlencoded bodies per the OAuth1 spec. JSON/GraphQL/raw bodies
   * are never included (matches Postman's own OAuth1 behavior).
   */
  bodyParams?: Record<string, string>
}

/**
 * RFC 3986 percent-encoding, as required by the OAuth1 spec — stricter than
 * `encodeURIComponent`, which leaves `! * ' ( )` unescaped. Using
 * `encodeURIComponent` directly is a well-known source of OAuth1 interop bugs.
 */
function oauthPercentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!*'()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** Builds the full `Authorization: OAuth ...` header value for a request. */
export function buildOAuth1Header(params: OAuth1SignParams): string {
  const {
    method, url, consumerKey, consumerSecret, token, tokenSecret,
    signatureMethod, realm, bodyParams,
  } = params

  const parsedUrl = new URL(url)
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: signatureMethod,
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...(token ? { oauth_token: token } : {}),
  }

  // Signature base string covers OAuth params + query params + (for form-urlencoded bodies) body params
  const allParams: Record<string, string> = { ...oauthParams }
  for (const [k, v] of parsedUrl.searchParams.entries()) allParams[k] = v
  if (bodyParams) Object.assign(allParams, bodyParams)

  const sortedEncodedParams = Object.keys(allParams)
    .sort()
    .map(k => `${oauthPercentEncode(k)}=${oauthPercentEncode(allParams[k]!)}`)
    .join('&')

  const signatureBaseString = [
    method.toUpperCase(),
    oauthPercentEncode(baseUrl),
    oauthPercentEncode(sortedEncodedParams),
  ].join('&')

  const signingKey = `${oauthPercentEncode(consumerSecret)}&${oauthPercentEncode(tokenSecret ?? '')}`
  const algo = signatureMethod === 'HMAC-SHA256' ? 'sha256' : 'sha1'
  const signature = createHmac(algo, signingKey).update(signatureBaseString).digest('base64')

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature }
  if (realm) headerParams.realm = realm

  const headerParts = Object.keys(headerParams)
    .map(k => `${oauthPercentEncode(k)}="${oauthPercentEncode(headerParams[k]!)}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}
