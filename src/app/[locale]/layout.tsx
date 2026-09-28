import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { routing } from '@/i18n/routing'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'KayScope',
  description: 'A collaborative REST API testing platform',
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

// Required for `output: 'export'` (KayScope Desktop's static build) to know
// which locale segments to pre-render — harmless no-op for the normal SSR build.
export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = params

  if (!routing.locales.includes(locale as 'en' | 'vi')) {
    notFound()
  }

  // Tell next-intl the active locale for this request (required when not using next-intl middleware)
  setRequestLocale(locale)

  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
