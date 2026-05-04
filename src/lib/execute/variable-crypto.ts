import { encryptValue, decryptValue, isEncrypted, maskValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

export function maskVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: maskValue() } : v)
}

export function encryptVariables(incoming: Variable[], existing: Variable[]): Variable[] {
  return incoming.map(v => {
    if (!v.secret) return v
    const existingVar = existing.find(e => e.key === v.key)
    if (existingVar?.secret && v.value === maskValue()) return { ...v, value: existingVar.value }
    if (isEncrypted(v.value)) return v
    return { ...v, value: encryptValue(v.value) }
  })
}

export function decryptVariables(variables: Variable[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const v of variables) {
    if (!v.enabled) continue
    result[v.key] = isEncrypted(v.value) ? decryptValue(v.value) : v.value
  }
  return result
}
