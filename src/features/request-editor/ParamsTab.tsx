'use client'

import KVEditor, { type KVRow } from '@/components/KVEditor'
import type { SaveScope } from '@/components/VarHoverPopover'

interface Props {
  params: KVRow[]
  onChange: (params: KVRow[]) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  hasCollection?: boolean
  hasEnvironment?: boolean
  collectionName?: string
  environmentName?: string
  onSaveVar?: (scope: SaveScope, name: string, value: string) => Promise<void>
  onNavigateToVariables?: () => void
}

export default function ParamsTab({
  params, onChange,
  localScope, environmentVariables, collectionVariables, globalVariables,
  hasCollection, hasEnvironment, collectionName, environmentName,
  onSaveVar, onNavigateToVariables,
}: Props) {
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
        collectionVariables={collectionVariables}
        globalVariables={globalVariables}
        hasCollection={hasCollection}
        hasEnvironment={hasEnvironment}
        collectionName={collectionName}
        environmentName={environmentName}
        onSaveVar={onSaveVar}
        onNavigateToVariables={onNavigateToVariables}
      />
    </div>
  )
}
