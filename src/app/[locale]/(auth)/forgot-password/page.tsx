'use client'

import AuthGuard from '@/components/AuthGuard'
import ForgotPasswordForm from '@/features/auth/ForgotPasswordForm'

export default function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  const { locale } = params

  return (
    <AuthGuard locale={locale} mode="redirect-if-auth">
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <ForgotPasswordForm />
      </div>
    </AuthGuard>
  )
}
