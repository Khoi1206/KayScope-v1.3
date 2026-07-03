'use client'

import { cn } from '@/components/ui/cn'
import type { RequestSettings } from '@/store/request.store'

interface Props {
  settings: RequestSettings
  onChange: (s: RequestSettings) => void
}

const DEFAULT_SETTINGS: RequestSettings = {
  timeout: 30_000,
  followRedirects: true,
  maxRedirects: 10,
  sendCookies: true,
  saveCookies: true,
  sslVerify: true,
}

export function defaultSettings(): RequestSettings {
  return { ...DEFAULT_SETTINGS }
}

export default function SettingsTab({ settings, onChange }: Props) {
  function patch(patch: Partial<RequestSettings>) {
    onChange({ ...settings, ...patch })
  }

  const isDefault =
    settings.timeout === DEFAULT_SETTINGS.timeout &&
    settings.followRedirects === DEFAULT_SETTINGS.followRedirects &&
    settings.maxRedirects === DEFAULT_SETTINGS.maxRedirects &&
    settings.sendCookies === DEFAULT_SETTINGS.sendCookies &&
    settings.saveCookies === DEFAULT_SETTINGS.saveCookies &&
    settings.sslVerify === DEFAULT_SETTINGS.sslVerify

  return (
    <div className="p-4 text-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-th-fg">Request Settings</h3>
        {!isDefault && (
          <button
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="rounded px-2 py-0.5 text-[11px] text-th-fg-muted hover:text-th-fg hover:bg-th-surface-hover"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-th-border bg-th-surface p-4">
        {/* Timeout */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
          <div>
            <p className="font-medium text-th-fg">Request Timeout</p>
            <p className="mt-0.5 text-[11px] text-th-fg-muted">Abort if no response within this limit</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1000}
              max={300_000}
              step={1000}
              value={settings.timeout}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1000 && v <= 300_000) patch({ timeout: v })
              }}
              className="w-28 rounded-lg border border-th-border bg-th-input px-2 py-1 font-mono text-th-fg focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            />
            <span className="text-th-fg-muted">ms</span>
            <span className="text-th-fg-subtle">({(settings.timeout / 1000).toFixed(0)}s)</span>
          </div>
        </div>

        <div className="border-t border-th-border" />

        {/* Follow redirects */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
          <div>
            <p className="font-medium text-th-fg">Follow Redirects</p>
            <p className="mt-0.5 text-[11px] text-th-fg-muted">Automatically follow 3xx responses</p>
          </div>
          <button
            onClick={() => patch({ followRedirects: !settings.followRedirects })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.followRedirects ? 'bg-th-accent' : 'bg-th-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                settings.followRedirects ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>

        {/* Max redirects (only when followRedirects is on) */}
        {settings.followRedirects && (
          <>
            <div className="border-t border-th-border" />
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <div>
                <p className="font-medium text-th-fg">Max Redirects</p>
                <p className="mt-0.5 text-[11px] text-th-fg-muted">Maximum number of redirects to follow</p>
              </div>
              <input
                type="number"
                min={0}
                max={20}
                value={settings.maxRedirects}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 0 && v <= 20) patch({ maxRedirects: v })
                }}
                className="w-20 rounded-lg border border-th-border bg-th-input px-2 py-1 font-mono text-th-fg focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
              />
            </div>
          </>
        )}

        <div className="border-t border-th-border" />

        {/* Send cookies */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
          <div>
            <p className="font-medium text-th-fg">Send Cookies</p>
            <p className="mt-0.5 text-[11px] text-th-fg-muted">Attach matching cookie jar cookies to this request</p>
          </div>
          <button
            onClick={() => patch({ sendCookies: !settings.sendCookies })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.sendCookies ? 'bg-th-accent' : 'bg-th-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                settings.sendCookies ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>

        <div className="border-t border-th-border" />

        {/* Save cookies */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
          <div>
            <p className="font-medium text-th-fg">Save Cookies</p>
            <p className="mt-0.5 text-[11px] text-th-fg-muted">Store Set-Cookie headers from the response into the cookie jar</p>
          </div>
          <button
            onClick={() => patch({ saveCookies: !settings.saveCookies })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.saveCookies ? 'bg-th-accent' : 'bg-th-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                settings.saveCookies ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>

        <div className="border-t border-th-border" />

        {/* SSL verification */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
          <div>
            <p className="font-medium text-th-fg">SSL Certificate Verification</p>
            <p className="mt-0.5 text-[11px] text-th-fg-muted">Disable only for trusted hosts with self-signed certificates</p>
          </div>
          <button
            onClick={() => patch({ sslVerify: !settings.sslVerify })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.sslVerify ? 'bg-th-accent' : 'bg-th-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                settings.sslVerify ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-th-fg-subtle">
        Settings apply to this tab only and are not saved with the request.
      </p>
    </div>
  )
}
