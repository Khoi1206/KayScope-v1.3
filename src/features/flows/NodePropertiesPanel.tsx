'use client'

import type { FlowNode, FlowNodeData, NodeType } from '@/db/schema/flows'

interface Props {
  node: FlowNode
  onChange: (id: string, data: Partial<FlowNodeData>) => void
}

const ROLE_OPTIONS = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'option', 'heading'] as const

export default function NodePropertiesPanel({ node, onChange }: Props) {
  const d = node.data
  const set = (patch: Partial<FlowNodeData>) => onChange(node.id, patch)

  return (
    <div className="flex h-full w-60 flex-col overflow-y-auto border-l border-th-border bg-th-surface">
      <div className="px-3 py-2 border-b border-th-border">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">Properties</p>
        <p className="text-xs font-medium text-th-fg mt-0.5 truncate">{d.label || '(untitled)'}</p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {/* Label — always shown */}
        <Field label="Label">
          <input
            className={inputCls}
            value={d.label}
            onChange={e => set({ label: e.target.value })}
            placeholder="Node label"
          />
        </Field>

        {/* Type-specific fields */}
        {d.type === 'navigate' && (
          <Field label="URL">
            <input className={inputCls} value={d.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="https://example.com" />
          </Field>
        )}

        {(d.type === 'click_text' || d.type === 'hover_text' || d.type === 'assert_visible' || d.type === 'assert_not_visible' || d.type === 'wait_selector') && (
          <Field label="Text">
            <input className={inputCls} value={d.text ?? ''} onChange={e => set({ text: e.target.value })} placeholder="Text to match" />
          </Field>
        )}

        {d.type === 'click_role' && (
          <>
            <Field label="Role">
              <select className={inputCls} value={d.role ?? 'button'} onChange={e => set({ role: e.target.value as typeof ROLE_OPTIONS[number] })}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Name">
              <input className={inputCls} value={d.roleName ?? ''} onChange={e => set({ roleName: e.target.value })} placeholder="Accessible name" />
            </Field>
          </>
        )}

        {(d.type === 'click_placeholder' || d.type === 'fill_placeholder' || d.type === 'assert_value') && (
          <Field label="Placeholder">
            <input className={inputCls} value={d.placeholder ?? ''} onChange={e => set({ placeholder: e.target.value })} placeholder="Input placeholder" />
          </Field>
        )}

        {d.type === 'click_title' && (
          <Field label="Title">
            <input className={inputCls} value={d.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="Element title attribute" />
          </Field>
        )}

        {(d.type === 'fill_label' || d.type === 'select_option') && (
          <Field label="Label text">
            <input className={inputCls} value={d.labelText ?? ''} onChange={e => set({ labelText: e.target.value })} placeholder="Form label text" />
          </Field>
        )}

        {(d.type === 'fill_placeholder' || d.type === 'fill_label' || d.type === 'assert_value') && (
          <Field label="Value">
            <input className={inputCls} value={d.value ?? ''} onChange={e => set({ value: e.target.value })} placeholder={d.type === 'assert_value' ? 'Expected value' : 'Text to fill'} />
          </Field>
        )}

        {d.type === 'select_option' && (
          <Field label="Option">
            <input className={inputCls} value={d.option ?? ''} onChange={e => set({ option: e.target.value })} placeholder="Option value or label" />
          </Field>
        )}

        {d.type === 'assert_url' && (
          <Field label="URL pattern (regex)">
            <input className={inputCls} value={d.pattern ?? ''} onChange={e => set({ pattern: e.target.value })} placeholder="e.g. /dashboard" />
          </Field>
        )}

        {d.type === 'wait_ms' && (
          <Field label="Milliseconds">
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
          <Field label="Screenshot name">
            <input className={inputCls} value={d.screenshotName ?? ''} onChange={e => set({ screenshotName: e.target.value })} placeholder="e.g. login-page" />
          </Field>
        )}
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
