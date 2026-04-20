import { redirect } from 'next/navigation'

// Root locale page: redirect to dashboard (middleware handles auth check)
export default function RootPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard`)
}
