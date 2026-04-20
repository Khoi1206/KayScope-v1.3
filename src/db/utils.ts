import { randomUUID } from 'crypto'

/** Generate a UUID using Node crypto. */
export function createId(): string {
  return randomUUID()
}
