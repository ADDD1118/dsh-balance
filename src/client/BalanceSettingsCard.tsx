/**
 * The dsh-balance "adjust size" card, registered into `settings.plugin.item`
 * under the `dsh-balance` namespace. A minimal self-contained form: a numeric
 * width input and a Save button, writing to the settings scope.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { NS } from './locales.ts'
import { BALANCE_NS, type BalanceSettingsCardInjected } from './balance-settings-controller.ts'

export type BalanceSettingsCardProps =
  PropsRuntime<'settings.plugin.item'> & PropsLocale<typeof NS> & BalanceSettingsCardInjected

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }
const label: CSSProperties = { fontSize: 13, color: 'var(--dsw-alias-label-primary)', fontWeight: 600, minWidth: 90 }
const input: CSSProperties = { flex: 1, height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, boxSizing: 'border-box' }
const button: CSSProperties = { height: 30, padding: '0 14px', borderRadius: 15, border: 'none', cursor: 'pointer', background: 'var(--dsw-alias-button-info-fill)', color: '#fff', fontSize: 13, fontWeight: 600 }
const hint: CSSProperties = { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginTop: 4 }

export function BalanceSettingsCard({ t, getWidth, setWidth }: BalanceSettingsCardProps) {
  const [draft, setDraft] = useState<string>(() => { const w = getWidth(); return w === undefined ? '200' : String(w) })
  const [done, setDone] = useState(false)
  const parsed = Number(draft)
  const valid = Number.isFinite(parsed) && parsed >= 100 && parsed <= 400

  return (
    <div>
      <div style={row}>
        <span style={label}>{t('settings.width')}</span>
        <input
          style={input}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label={t('settings.width')}
          onChange={(e) => { setDraft(e.target.value); setDone(false) }}
        />
        <button
          style={{ ...button, opacity: valid ? 1 : 0.5 }}
          disabled={!valid}
          onClick={() => { void setWidth(parsed).then(() => { setDone(true) }); }}
        >
          {t('settings.save')}
        </button>
      </div>
      <div style={hint}>{t('settings.widthHint')}</div>
      {done && <div style={{ ...hint, color: 'var(--dsw-alias-state-success-primary)' }}>{t('settings.saved')}</div>}
      <input type="hidden" value={BALANCE_NS} readOnly />
    </div>
  )
}
