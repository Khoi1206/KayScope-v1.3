'use client'

import { useTranslations } from 'next-intl'
import { Copy } from 'lucide-react'
import type { FlowNode, FlowNodeData, NodeType } from '@/db/schema/flows'

interface Props {
  node: FlowNode
  onChange: (id: string, data: Partial<FlowNodeData>) => void
  onDuplicate: () => void
}

const ROLE_OPTIONS = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'option', 'heading'] as const

// Node types that resolve to a Playwright locator, and so can be overridden
// with a Test ID / CSS selector / iframe scope, or use {{variable}} tokens.
const LOCATOR_NODE_TYPES: readonly NodeType[] = [
  'click_text', 'click_role', 'click_placeholder', 'click_title', 'hover_text',
  'fill_placeholder', 'fill_label', 'select_option',
  'assert_visible', 'assert_not_visible', 'assert_value',
  'wait_selector',
  'press_key', 'upload_file', 'drag_drop', 'click_new_tab',
]

const DIALOG_ACTIONS = ['accept', 'dismiss'] as const

export default function NodePropertiesPanel({ node, onChange, onDuplicate }: Props) {
  const t = useTranslations('flows')
  const d = node.data
  const set = (patch: Partial<FlowNodeData>) => onChange(node.id, patch)
  const isLocatorNode = LOCATOR_NODE_TYPES.includes(d.type)

  return (
    <div className="flex h-full w-60 flex-col overflow-y-auto border-l border-th-border bg-th-surface">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-th-border">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">{t('properties.header')}</p>
          <p className="text-xs font-medium text-th-fg mt-0.5 truncate">{d.label || t('properties.untitled')}</p>
        </div>
        <button
          onClick={onDuplicate}
          title={t('properties.duplicateHint')}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Copy size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {/* Label — always shown */}
        <Field label={t('properties.label')}>
          <input
            className={inputCls}
            value={d.label}
            onChange={e => set({ label: e.target.value })}
            placeholder={t('properties.labelPlaceholder')}
          />
        </Field>

        {/* Type-specific fields */}
        {d.type === 'navigate' && (
          <Field label={t('properties.url')}>
            <input className={inputCls} value={d.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder={t('properties.urlPlaceholder')} />
          </Field>
        )}

        {(d.type === 'click_text' || d.type === 'hover_text' || d.type === 'assert_visible' || d.type === 'assert_not_visible' || d.type === 'wait_selector' || d.type === 'click_new_tab') && (
          <Field label={t('properties.text')}>
            <input className={inputCls} value={d.text ?? ''} onChange={e => set({ text: e.target.value })} placeholder={t('properties.textPlaceholder')} />
          </Field>
        )}

        {d.type === 'press_key' && (
          <>
            <Field label={t('properties.key')}>
              <input className={inputCls} value={d.key ?? ''} onChange={e => set({ key: e.target.value })} placeholder={t('properties.keyPlaceholder')} />
            </Field>
            <Field label={t('properties.focusText')}>
              <input className={inputCls} value={d.text ?? ''} onChange={e => set({ text: e.target.value })} placeholder={t('properties.focusTextPlaceholder')} />
            </Field>
          </>
        )}

        {d.type === 'handle_dialog' && (
          <>
            <Field label={t('properties.dialogActionLabel')}>
              <select className={inputCls} value={d.dialogAction ?? 'accept'} onChange={e => set({ dialogAction: e.target.value as typeof DIALOG_ACTIONS[number] })}>
                {DIALOG_ACTIONS.map(a => (
                  <option key={a} value={a}>{a === 'accept' ? t('properties.dialogAccept') : t('properties.dialogDismiss')}</option>
                ))}
              </select>
            </Field>
            <Field label={t('properties.promptText')}>
              <input className={inputCls} value={d.promptText ?? ''} onChange={e => set({ promptText: e.target.value })} placeholder={t('properties.promptTextPlaceholder')} />
            </Field>
            <p className="text-[10px] text-th-fg-subtle">{t('properties.dialogHint')}</p>
          </>
        )}

        {d.type === 'upload_file' && (
          <>
            <Field label={t('properties.filePath')}>
              <input className={inputCls} value={d.filePath ?? ''} onChange={e => set({ filePath: e.target.value })} placeholder={t('properties.filePathPlaceholder')} />
            </Field>
            <p className="text-[10px] text-th-fg-subtle">{t('properties.filePathHint')}</p>
          </>
        )}

        {d.type === 'drag_drop' && (
          <>
            <Field label={t('properties.sourceText')}>
              <input className={inputCls} value={d.text ?? ''} onChange={e => set({ text: e.target.value })} placeholder={t('properties.sourceTextPlaceholder')} />
            </Field>
            <Field label={t('properties.targetSelector')}>
              <input className={inputCls} value={d.targetSelector ?? ''} onChange={e => set({ targetSelector: e.target.value })} placeholder={t('properties.targetSelectorPlaceholder')} />
            </Field>
          </>
        )}

        {d.type === 'click_role' && (
          <>
            <Field label={t('properties.role')}>
              <select className={inputCls} value={d.role ?? 'button'} onChange={e => set({ role: e.target.value as typeof ROLE_OPTIONS[number] })}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label={t('properties.roleName')}>
              <input className={inputCls} value={d.roleName ?? ''} onChange={e => set({ roleName: e.target.value })} placeholder={t('properties.roleNamePlaceholder')} />
            </Field>
          </>
        )}

        {(d.type === 'click_placeholder' || d.type === 'fill_placeholder' || d.type === 'assert_value') && (
          <Field label={t('properties.placeholder')}>
            <input className={inputCls} value={d.placeholder ?? ''} onChange={e => set({ placeholder: e.target.value })} placeholder={t('properties.placeholderPlaceholder')} />
          </Field>
        )}

        {d.type === 'click_title' && (
          <Field label={t('properties.elementTitle')}>
            <input className={inputCls} value={d.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder={t('properties.elementTitlePlaceholder')} />
          </Field>
        )}

        {(d.type === 'fill_label' || d.type === 'select_option') && (
          <Field label={t('properties.labelText')}>
            <input className={inputCls} value={d.labelText ?? ''} onChange={e => set({ labelText: e.target.value })} placeholder={t('properties.labelTextPlaceholder')} />
          </Field>
        )}

        {(d.type === 'fill_placeholder' || d.type === 'fill_label' || d.type === 'assert_value') && (
          <Field label={t('properties.value')}>
            <input className={inputCls} value={d.value ?? ''} onChange={e => set({ value: e.target.value })} placeholder={d.type === 'assert_value' ? t('properties.valuePlaceholderAssert') : t('properties.valuePlaceholderFill')} />
          </Field>
        )}

        {d.type === 'select_option' && (
          <Field label={t('properties.option')}>
            <input className={inputCls} value={d.option ?? ''} onChange={e => set({ option: e.target.value })} placeholder={t('properties.optionPlaceholder')} />
          </Field>
        )}

        {d.type === 'assert_url' && (
          <Field label={t('properties.urlPattern')}>
            <input className={inputCls} value={d.pattern ?? ''} onChange={e => set({ pattern: e.target.value })} placeholder={t('properties.urlPatternPlaceholder')} />
          </Field>
        )}

        {d.type === 'assert_api_response' && (
          <>
            <Field label={t('properties.apiUrlPattern')}>
              <input className={inputCls} value={d.apiUrlPattern ?? ''} onChange={e => set({ apiUrlPattern: e.target.value })} placeholder={t('properties.apiUrlPatternPlaceholder')} />
            </Field>
            <Field label={t('properties.apiExpectedStatus')}>
              <input
                type="number"
                className={inputCls}
                value={d.apiExpectedStatus ?? ''}
                min={100}
                max={599}
                onChange={e => set({ apiExpectedStatus: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                placeholder={t('properties.apiExpectedStatusPlaceholder')}
              />
            </Field>
            <p className="text-[10px] text-th-fg-subtle">{t('properties.apiResponseHint')}</p>
          </>
        )}

        {d.type === 'wait_ms' && (
          <Field label={t('properties.milliseconds')}>
            <input
              type="number"
              className={inputCls}
              value={d.ms ?? 1000}
              min={0}
              max={60000}
              onChange={e => set({ ms: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
        )}

        {d.type === 'screenshot' && (
          <Field label={t('properties.screenshotName')}>
            <input className={inputCls} value={d.screenshotName ?? ''} onChange={e => set({ screenshotName: e.target.value })} placeholder={t('properties.screenshotNamePlaceholder')} />
          </Field>
        )}

        {/* Advanced selector override — takes priority over the native strategy above */}
        {isLocatorNode && (
          <div className="mt-1 flex flex-col gap-3 rounded border border-th-border/50 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-th-fg-subtle">
              {t('properties.advancedHeader')}
            </p>
            <Field label={t('properties.testId')}>
              <input
                className={inputCls}
                value={d.testId ?? ''}
                onChange={e => set({ testId: e.target.value })}
                placeholder={t('properties.testIdPlaceholder')}
              />
            </Field>
            <Field label={t('properties.cssSelector')}>
              <input
                className={inputCls}
                value={d.selector ?? ''}
                onChange={e => set({ selector: e.target.value })}
                placeholder={t('properties.cssSelectorPlaceholder')}
              />
            </Field>
            <Field label={t('properties.iframeSelector')}>
              <input
                className={inputCls}
                value={d.frameSelector ?? ''}
                onChange={e => set({ frameSelector: e.target.value })}
                placeholder={t('properties.iframeSelectorPlaceholder')}
              />
            </Field>
            <p className="text-[10px] text-th-fg-subtle">
              {t('properties.advancedHint')}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-th-border px-3 py-2">
        <p className="text-[10px] text-th-fg-subtle">
          {t('properties.variableHint', { tokenExample: '{{variable}}' })}
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-th-fg-muted">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent w-full'
