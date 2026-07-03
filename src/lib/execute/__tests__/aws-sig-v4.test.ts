import { describe, it, expect } from 'vitest'
import { buildAwsSigV4Headers } from '../aws-sig-v4'

const baseParams = {
  method: 'GET',
  url: 'https://dynamodb.us-east-1.amazonaws.com/',
  headers: { 'Content-Type': 'application/x-amz-json-1.0' },
  body: '{}',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secretkeyexample',
  region: 'us-east-1',
  service: 'dynamodb',
}

describe('buildAwsSigV4Headers', () => {
  it('adds an Authorization header using the AWS4-HMAC-SHA256 scheme', () => {
    const headers = buildAwsSigV4Headers(baseParams)
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\//)
  })

  it('adds an X-Amz-Date header', () => {
    const headers = buildAwsSigV4Headers(baseParams)
    expect(headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/)
  })

  it('passes through the original headers unchanged', () => {
    const headers = buildAwsSigV4Headers(baseParams)
    expect(headers['Content-Type']).toBe('application/x-amz-json-1.0')
  })

  it('adds X-Amz-Security-Token when a session token is provided', () => {
    const headers = buildAwsSigV4Headers({ ...baseParams, sessionToken: 'session-token-value' })
    expect(headers['X-Amz-Security-Token']).toBe('session-token-value')
  })

  it('omits X-Amz-Security-Token when no session token is provided', () => {
    const headers = buildAwsSigV4Headers(baseParams)
    expect(headers['X-Amz-Security-Token']).toBeUndefined()
  })

  it('produces a different signature for a different region/service (sanity: credential scope affects signing)', () => {
    const h1 = buildAwsSigV4Headers(baseParams)
    const h2 = buildAwsSigV4Headers({ ...baseParams, region: 'eu-west-1' })
    expect(h1.Authorization).not.toBe(h2.Authorization)
    expect(h1.Authorization).toContain('/us-east-1/dynamodb/')
    expect(h2.Authorization).toContain('/eu-west-1/dynamodb/')
  })
})
