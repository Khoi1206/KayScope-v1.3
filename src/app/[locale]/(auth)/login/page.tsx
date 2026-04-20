import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import LoginForm from '@/features/auth/LoginForm'

export default async function LoginPage({ params }: { params: { locale: string } }) {
  const session = await auth()
  if (session) redirect(`/${params.locale}/dashboard`)

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
      <LoginForm />
    </div>
  )
}
