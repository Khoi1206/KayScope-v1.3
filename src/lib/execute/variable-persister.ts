import { encryptValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

export interface PersistMutationsInput {
  workspaceId: string
  environmentId?: string
  collectionId?: string
}

export type ScopeMutations = {
  environment: Record<string, string>
  collection: Record<string, string>
  global: Record<string, string>
}

function applyMutationsToVars(vars: Variable[], mutated: Record<string, string>): Variable[] {
  const updated = vars.map(v => {
    if (mutated[v.key] === undefined) return v
    return { ...v, value: v.secret ? encryptValue(mutated[v.key]!) : mutated[v.key]! }
  })
  for (const [key, value] of Object.entries(mutated)) {
    if (!updated.find(v => v.key === key)) {
      updated.push({ key, value, enabled: true, secret: false })
    }
  }
  return updated
}

export async function persistMutations(
  input: PersistMutationsInput,
  mutations: ScopeMutations
): Promise<void> {
  const { updateEnvironment, findEnvironmentByIdForWorkspace } = await import('@/db/queries/environments')
  const { updateCollection, findCollectionByIdForWorkspace } = await import('@/db/queries/collections')
  const { updateWorkspace, findWorkspaceById } = await import('@/db/queries/workspaces')

  if (input.environmentId && Object.keys(mutations.environment).length > 0) {
    const env = await findEnvironmentByIdForWorkspace(input.environmentId, input.workspaceId)
    if (env) {
      await updateEnvironment(input.environmentId, {
        variables: applyMutationsToVars(env.variables, mutations.environment),
      })
    }
  }

  if (input.collectionId && Object.keys(mutations.collection).length > 0) {
    const col = await findCollectionByIdForWorkspace(input.collectionId, input.workspaceId)
    if (col) {
      await updateCollection(input.collectionId, {
        variables: applyMutationsToVars(col.variables ?? [], mutations.collection),
      })
    }
  }

  if (Object.keys(mutations.global).length > 0) {
    const ws = await findWorkspaceById(input.workspaceId)
    if (ws) {
      await updateWorkspace(input.workspaceId, {
        globalVariables: applyMutationsToVars(ws.globalVariables, mutations.global),
      })
    }
  }
}
