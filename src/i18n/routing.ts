import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
})

// Locale-aware navigation helpers — import these instead of next/navigation
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)
