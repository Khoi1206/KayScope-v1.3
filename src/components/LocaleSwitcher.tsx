'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export default function LocaleSwitcher() {
  const locale = useLocale()
  const pathname = usePathname() // full path e.g. /en/dashboard
  const router = useRouter()

  function toggle() {
    const next = locale === 'en' ? 'vi' : 'en'
    // Replace the leading locale segment with the new one
    const newPath = pathname.replace(/^\/(en|vi)/, `/${next}`)
    router.push(newPath)
  }

  return (
    <button
      onClick={toggle}
      title="Switch language"
      className="rounded px-2 py-1 text-xs font-medium text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
    >
      {locale === 'en' ? 'VI' : 'EN'}
    </button>
  )
}
