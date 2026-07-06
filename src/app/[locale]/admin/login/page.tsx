import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import AdminLoginForm from '@/features/admin/AdminLoginForm'

export default async function AdminLoginPage({ params }: { params: { locale: string } }) {
  const session = await auth().catch(() => null)
  if (session?.user && (session.user as { isAdmin?: boolean }).isAdmin === true) {
    redirect(`/${params.locale}/admin`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
      <AdminLoginForm />
    </div>
  )
}
