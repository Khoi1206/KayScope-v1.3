import aws4 from 'aws4'

export interface AwsSigV4Params {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
  service: string
}

/**
 * Signs a request with AWS Signature v4 using the `aws4` package (small,
 * zero-dependency) rather than hand-rolling the canonical-request algorithm
 * (header canonicalization, credential-scope construction, 4-round signing-key
 * derivation — meaningfully more failure-prone to get right than OAuth1's
 * simpler HMAC). Returns the full header set (signed + pass-through) —
 * `aws4.sign` mutates its `headers` argument in place.
 */
export function buildAwsSigV4Headers(params: AwsSigV4Params): Record<string, string> {
  const parsedUrl = new URL(params.url)
  const opts = {
    method: params.method,
    host: parsedUrl.host,
    path: parsedUrl.pathname + parsedUrl.search,
    headers: { ...params.headers },
    body: params.body ?? undefined,
    region: params.region,
    service: params.service,
  }
  aws4.sign(opts, {
    accessKeyId: params.accessKeyId,
    secretAccessKey: params.secretAccessKey,
    sessionToken: params.sessionToken,
  })
  return opts.headers as Record<string, string>
}
