'use client'

import KVEditor, { type KVRow } from '@/components/KVEditor'

interface Props {
  headers: KVRow[]
  onChange: (headers: KVRow[]) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSetLocalVar?: (name: string, value: string) => void
}

export default function HeadersTab({ headers, onChange, localScope, environmentVariables, onSetLocalVar }: Props) {
  return (
    <div className="p-3">
      <KVEditor
        rows={headers}
        onChange={onChange}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        showDescription
        localScope={localScope}
        environmentVariables={environmentVariables}
        onSetLocalVar={onSetLocalVar}
      />
    </div>
  )
}
