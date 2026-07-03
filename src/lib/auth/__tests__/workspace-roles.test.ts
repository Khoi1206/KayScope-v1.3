import { describe, it, expect } from 'vitest'
import { roleAtLeast } from '../workspace-roles'

describe('roleAtLeast — role ranking', () => {
  it('owner satisfies every minimum', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true)
    expect(roleAtLeast('owner', 'editor')).toBe(true)
    expect(roleAtLeast('owner', 'viewer')).toBe(true)
  })

  it('admin satisfies editor and viewer minimums but not owner', () => {
    expect(roleAtLeast('admin', 'editor')).toBe(true)
    expect(roleAtLeast('admin', 'viewer')).toBe(true)
    expect(roleAtLeast('admin', 'owner')).toBe(false)
  })

  it('editor satisfies viewer minimum but not admin', () => {
    expect(roleAtLeast('editor', 'viewer')).toBe(true)
    expect(roleAtLeast('editor', 'admin')).toBe(false)
  })

  it('viewer does not satisfy editor or admin minimums', () => {
    expect(roleAtLeast('viewer', 'editor')).toBe(false)
    expect(roleAtLeast('viewer', 'admin')).toBe(false)
  })

  it('every role satisfies its own rank as the minimum', () => {
    expect(roleAtLeast('viewer', 'viewer')).toBe(true)
    expect(roleAtLeast('editor', 'editor')).toBe(true)
    expect(roleAtLeast('admin', 'admin')).toBe(true)
    expect(roleAtLeast('owner', 'owner')).toBe(true)
  })
})
