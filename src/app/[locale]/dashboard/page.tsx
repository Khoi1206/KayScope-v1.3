import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import WorkspaceShell from './WorkspaceShell'

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const session = await requireSession().catch(() => null)
  if (!session) redirect(`/${params.locale}/login`)

  return <WorkspaceShell userId={session.user.id} />
}
