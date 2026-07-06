import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'
import AdminShell from '@/features/admin/AdminShell'

export default async function AdminCmsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const session = await requireAdmin().catch(() => null)
  if (!session) redirect(`/${params.locale}/admin/login`)

  return (
    <AdminShell currentUserName={session.user.name ?? session.user.email}>
      {children}
    </AdminShell>
  )
}
