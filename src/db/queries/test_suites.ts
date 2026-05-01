import { eq, and, asc } from 'drizzle-orm'
import { db, testSuites } from '../index'

export async function findTestSuitesByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(testSuites)
    .where(eq(testSuites.workspaceId, workspaceId))
    .orderBy(asc(testSuites.sortOrder), asc(testSuites.createdAt))
}

export async function findTestSuiteById(id: string) {
  const rows = await db.select().from(testSuites).where(eq(testSuites.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findTestSuiteByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(testSuites)
    .where(and(eq(testSuites.id, id), eq(testSuites.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createTestSuite(
  workspaceId: string,
  data: {
    collectionId: string
    name: string
    description?: string
    environmentId?: string
    dataRows: Record<string, string>[]
    createdBy: string
  }
) {
  const rows = await db.insert(testSuites).values({ workspaceId, ...data }).returning()
  return rows[0]!
}

export async function updateTestSuite(
  id: string,
  data: Partial<{
    name: string
    description: string | null
    environmentId: string | null
    dataRows: Record<string, string>[]
  }>
) {
  const rows = await db
    .update(testSuites)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(testSuites.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteTestSuite(id: string) {
  await db.delete(testSuites).where(eq(testSuites.id, id))
}
