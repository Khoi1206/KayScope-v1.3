import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import RegisterForm from '@/features/auth/RegisterForm'

export default async function RegisterPage({ params }: { params: { locale: string } }) {
  const session = await auth()
  if (session) redirect(`/${params.locale}/dashboard`)

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
      <RegisterForm />
    </div>
  )
}
