'use client'

import KVEditor, { type KVRow } from '@/components/KVEditor'

interface Props {
  params: KVRow[]
  onChange: (params: KVRow[]) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSetLocalVar?: (name: string, value: string) => void
}

export default function ParamsTab({ params, onChange, localScope, environmentVariables, onSetLocalVar }: Props) {
  return (
    <div className="p-3">
      <KVEditor
        rows={params}
        onChange={onChange}
        keyPlaceholder="Parameter"
        valuePlaceholder="Value"
        showDescription
        localScope={localScope}
        environmentVariables={environmentVariables}
        onSetLocalVar={onSetLocalVar}
      />
    </div>
  )
}
