import { redirect } from 'next/navigation'

// Self-registration is disabled — accounts are created by an admin in the CMS
// (/admin/users → New user). Original page kept below for reference.
export default function RegisterPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/login`)
}

/*
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
*/
