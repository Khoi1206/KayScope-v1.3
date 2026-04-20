'use client'

import MonacoEditor from '@/components/MonacoEditor'

interface Props {
  body: string
  contentType: string
}

function detectLanguage(contentType: string, body: string): string {
  if (contentType.includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) {
    return 'json'
  }
  if (contentType.includes('html')) return 'html'
  if (contentType.includes('xml')) return 'xml'
  if (contentType.includes('javascript')) return 'javascript'
  return 'plaintext'
}

function formatBody(body: string, lang: string): string {
  if (lang === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }
  return body
}

export default function PrettyViewer({ body, contentType }: Props) {
  const lang = detectLanguage(contentType, body)
  const formatted = formatBody(body, lang)

  if (!body) {
    return <p className="px-4 py-4 text-xs text-th-fg-subtle">No response body</p>
  }

  return (
    <div className="h-full min-h-[200px]">
      <MonacoEditor
        value={formatted}
        language={lang}
        height="100%"
        readOnly={true}
      />
    </div>
  )
}
