import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import logger from '@/lib/logger'

const ALGO = 'aes-256-gcm' as const
const ENC_PREFIX = 'enc:'

function getKey(): Buffer {
  const raw = process.env.VAR_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'VAR_ENCRYPTION_KEY is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) {
    throw new Error('VAR_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars).')
  }
  return buf
}

export function isEncrypted(val: string): boolean {
  return val.startsWith(ENC_PREFIX)
}

/** Encrypt a plaintext value. Returns an 'enc:' prefixed string. */
export function encryptValue(plain: string): string {
  if (!plain) return plain
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`
}

/** Decrypt an 'enc:' prefixed value. Returns plaintext or empty string on failure. */
export function decryptValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored // legacy plaintext passthrough

  const inner = stored.slice(ENC_PREFIX.length)
  const parts = inner.split(':')
  if (parts.length !== 3) return ''

  const [ivHex, ciphertextHex, tagHex] = parts
  try {
    const key = getKey()
    const iv = Buffer.from(ivHex!, 'hex')
    const ciphertext = Buffer.from(ciphertextHex!, 'hex')
    const tag = Buffer.from(tagHex!, 'hex')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
  } catch (err) {
    logger.error({ err, stored: stored.slice(0, 20) + '…' }, 'decryptValue failed')
    return ''
  }
}

/** Return a masked display value for a secret (never returns plaintext). */
export function maskValue(): string {
  return '••••••••'
}
