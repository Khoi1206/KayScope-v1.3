import { describe, it, expect, beforeEach } from 'vitest'
import { encryptValue, decryptValue, isEncrypted, maskValue } from '@/lib/crypto'

const TEST_KEY = 'a'.repeat(64) // 32-byte hex key for tests

beforeEach(() => {
  process.env.VAR_ENCRYPTION_KEY = TEST_KEY
})

describe('crypto — encrypt/decrypt', () => {
  it('encrypts a value to enc: prefixed string', () => {
    const encrypted = encryptValue('my-secret')
    expect(encrypted).toMatch(/^enc:/)
  })

  it('decrypts back to original plaintext', () => {
    const plain = 'super-secret-value'
    const encrypted = encryptValue(plain)
    expect(decryptValue(encrypted)).toBe(plain)
  })

  it('produces different ciphertext for same input (random IV)', () => {
    const a = encryptValue('same')
    const b = encryptValue('same')
    expect(a).not.toBe(b)
    expect(decryptValue(a)).toBe('same')
    expect(decryptValue(b)).toBe('same')
  })

  it('isEncrypted returns true for enc: prefix', () => {
    expect(isEncrypted(encryptValue('x'))).toBe(true)
  })

  it('isEncrypted returns false for plaintext', () => {
    expect(isEncrypted('plaintext')).toBe(false)
  })

  it('decryptValue returns plaintext value as-is (legacy passthrough)', () => {
    expect(decryptValue('plaintext-legacy')).toBe('plaintext-legacy')
  })

  it('decryptValue returns empty string for tampered ciphertext', () => {
    const enc = encryptValue('secret')
    const tampered = enc.replace(/enc:(.{4})/, 'enc:XXXX')
    expect(decryptValue(tampered)).toBe('')
  })

  it('returns empty string when empty input given to encryptValue', () => {
    expect(encryptValue('')).toBe('')
  })

  it('maskValue returns masked string, never the plaintext', () => {
    const masked = maskValue()
    expect(masked).not.toBe('plaintext')
    expect(masked.length).toBeGreaterThan(0)
  })
})

describe('crypto — wrong key size', () => {
  it('throws when VAR_ENCRYPTION_KEY is wrong length', () => {
    process.env.VAR_ENCRYPTION_KEY = 'tooshort'
    expect(() => encryptValue('x')).toThrow('32 bytes')
  })
})
