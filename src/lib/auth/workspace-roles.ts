// Pure role-ranking logic, deliberately free of any DB import so it can be
// unit-tested without a database connection — workspace-guard.ts (which does
// the DB-backed role lookup) re-exports these.
export type EffectiveRole = 'owner' | 'admin' | 'editor' | 'viewer'

const ROLE_RANK: Record<EffectiveRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

export function roleAtLeast(role: EffectiveRole, min: EffectiveRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}
