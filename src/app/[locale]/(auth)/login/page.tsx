'use client'

import AuthGuard from '@/components/AuthGuard'
import LoginForm from '@/features/auth/LoginForm'

export default function LoginPage({ params }: { params: { locale: string } }) {
  const { locale } = params

  return (
    <AuthGuard locale={locale} mode="redirect-if-auth">
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <LoginForm />
      </div>
    </AuthGuard>
  )
}
