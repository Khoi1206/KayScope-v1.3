import { randomUUID } from 'crypto'

/** A snapshot of all dynamic variable values for a single request execution. */
export type DynamicVarSnapshot = Record<string, string>

/**
 * Create a snapshot of dynamic variable values.
 * Called once per request so all `{{$guid}}` tokens in a single request
 * resolve to the same value.
 */
export function createDynamicVarSnapshot(): DynamicVarSnapshot {
  const now = new Date()
  return {
    $guid: randomUUID(),
    $timestamp: String(Math.floor(now.getTime() / 1000)),
    $isoTimestamp: now.toISOString(),
    $randomInt: String(Math.floor(Math.random() * 1000)),
  }
}

/** All known dynamic variable names (without {{ }}) */
export const DYNAMIC_VAR_NAMES = ['$guid', '$timestamp', '$isoTimestamp', '$randomInt'] as const
