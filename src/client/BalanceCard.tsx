/**
 * The floating balance card — a compact widget. The cut-out girl (transparent
 * background + bubble) is on top and her paws rest right on the liquid-glass
 * balance box, so she appears to cling onto it. The estimated-days value lives
 * in a small glass chip inside the speech bubble (top-left).
 *
 * The card stores its position as a *fraction of the free space* (`fx`/`fy` in
 * [0,1] over the area not occupied by the card itself), not as absolute pixels.
 * Rendering maps that fraction onto the current viewport, so when the browser
 * window moves to a differently-sized display (or is resized) the card keeps
 * its relative placement and never leaves the visible area — no re-snapping or
 * jump is needed to keep it reachable.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { NS } from './locales.ts'

export type BalanceCardProps = PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS>

interface Estimate {
  avgDaily7: number
  avgDaily30: number
  weightedDaily: number
  trend: number
  effectiveDaily: number
  estimatedDays: number | null
}
interface BalanceData { balance: number | null; currency: string; isAvailable: boolean; error?: string }
interface CardData { balance?: BalanceData | null; estimate?: Estimate | null; totalCost?: number; config?: { width?: number } }
interface SessionUsage { input: number; cacheRead: number; output: number; cost: number }

const POS_STORE = 'dsh-balance-pos'
const W = 200
const CARD_H0 = 260 // fallback card height before the DOM reports it

const glass: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(30,40,66,0.5), rgba(16,24,44,0.42))',
  backdropFilter: 'blur(12px) saturate(150%)',
  WebkitBackdropFilter: 'blur(12px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 22px rgba(0,0,0,0.24)',
  color: '#fff',
  fontFamily: 'var(--dsw-font-family)',
  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
}
const label = (size: number, op = 0.72): CSSProperties => ({ fontSize: size, fontWeight: 600, opacity: op, lineHeight: 1.3, whiteSpace: 'nowrap' })
const value = (size: number, w = 800): CSSProperties => ({ fontSize: size, fontWeight: w, lineHeight: 1.1, whiteSpace: 'nowrap' })

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)) }

/** Restore the saved position. New saves are fractions; older saves are pixels. */
function restorePos(): { fx: number; fy: number } {
  try {
    const raw = localStorage.getItem(POS_STORE)
    if (raw !== null) {
      const p = JSON.parse(raw) as { fx?: number; fy?: number; x?: number; y?: number }
      if (typeof p.fx === 'number' && typeof p.fy === 'number') {
        return { fx: clamp01(p.fx), fy: clamp01(p.fy) }
      }
      // Legacy absolute-pixels: convert against the current viewport so a saved
      // spot migrates to an equivalent relative position.
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        const fx = clamp01(p.x / Math.max(1, window.innerWidth - W))
        const fy = clamp01(p.y / Math.max(1, window.innerHeight - CARD_H0))
        return { fx, fy }
      }
    }
  } catch { /* ignore */ }
  return { fx: 0.98, fy: 0.08 }
}
function fmtMoney(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(Math.round(v))
}

export function BalanceCard({ useSessions, t }: BalanceCardProps) {
  const [data, setData] = useState<CardData | null>(null)
  const [sess, setSess] = useState<SessionUsage | null>(null)
  const [width, setWidth] = useState(200)
  const [pos, setPos] = useState(restorePos)
  const [viewport, setViewport] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }))
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Every font/layout pixel scales with the configured card width.
  const scale = width / 200
  const fs = (size: number): number => Math.round(size * scale)

  // Render-time mapping of the stored fraction onto the current viewport. The
  // card's own width/height are subtracted so the free space is the fraction's
  // range; with fx/fy in [0,1] the card is always fully inside the viewport.
  const cardH = cardRef.current?.offsetHeight ?? CARD_H0
  const maxX = Math.max(1, viewport.vw - width)
  const maxY = Math.max(1, viewport.vh - cardH)
  const left = Math.round(pos.fx * maxX)
  const top = Math.round(pos.fy * maxY)

  // Convert a desired top-left pixel position into a fraction, clamping to the
  // free space and snapping to the nearest edge when the card is dragged close.
  const toFraction = useCallback((x: number, y: number): { fx: number; fy: number } => {
    const h = cardRef.current?.offsetHeight ?? CARD_H0
    const mx = Math.max(1, viewport.vw - width)
    const my = Math.max(1, viewport.vh - h)
    let cx = Math.max(0, Math.min(x, mx))
    let cy = Math.max(0, Math.min(y, my))
    const edge = 16
    if (cx <= edge) cx = 0
    else if (cx >= mx - edge) cx = mx
    if (cy <= edge) cy = 0
    else if (cy >= my - edge) cy = my
    return { fx: cx / mx, fy: cy / my }
  }, [viewport, width])

  // Re-render on viewport changes so the fraction->pixel mapping recomputes for
  // the current window. Because pos is a fraction, the card keeps its relative
  // placement and stays in-bounds across monitors/resizes — no snapping needed.
  useEffect(() => {
    const onResize = () => setViewport({ vw: window.innerWidth, vh: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const sessionId = useSessions((s) => s.current)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/dsh-balance-card')
        const json = (await res.json()) as CardData
        if (alive) {
          setData(json)
          if (typeof json.config?.width === 'number') setWidth(json.config.width)
        }
      } catch { /* ignore */ }
    }
    void load()
    const timer = setInterval(() => { void load() }, 60_000)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (sessionId === undefined) { setSess(null); return }
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/dsh-session-usage?sessionId=${encodeURIComponent(sessionId)}`)
        const json = (await res.json()) as SessionUsage
        if (alive && 'cost' in json) setSess(json)
      } catch { /* ignore */ }
    }
    void load()
    const timer = setInterval(() => { void load() }, 60_000)
    return () => { alive = false; clearInterval(timer) }
  }, [sessionId])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointer.current = { x: e.clientX - left, y: e.clientY - top }
  }, [left, top])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current === null) return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setPos(toFraction(e.clientX - pointer.current.x, e.clientY - pointer.current.y))
  }, [toFraction])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current === null) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const final = toFraction(e.clientX - pointer.current.x, e.clientY - pointer.current.y)
    pointer.current = null
    setPos(final)
    try { localStorage.setItem(POS_STORE, JSON.stringify(final)) } catch { /* ignore */ }
  }, [toFraction])

  const est = data?.estimate ?? null
  const balance = data?.balance?.balance ?? null
  const trendTxt = est === null
    ? ''
    : est.trend > 0.001 ? t('card.trend.up') : est.trend < -0.001 ? t('card.trend.down') : t('card.trend.flat')
  const daysText = est === null || est.estimatedDays === null || est.estimatedDays === Number.POSITIVE_INFINITY
    ? t('card.days.unlimited')
    : t('card.days.value', { v: String(Math.floor(est.estimatedDays)) })

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={cardRef}
      style={{ position: 'fixed', left, top, zIndex: 1050, width, pointerEvents: 'auto', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
      role="dialog"
      aria-label={t('card.days')}
    >
      {/* girl (transparent) with the estimated-days text over the white speech bubble (no textbox) */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <img src="/dsh-balance-mascot?v=girlbubble8" alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '10%', top: '16%', width: '24%', height: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1, color: '#263a63', fontFamily: 'var(--dsw-font-family)' }}>
          <span style={{ fontSize: fs(8), fontWeight: 700, color: '#263a63', lineHeight: 1.2, whiteSpace: 'nowrap', opacity: 0.85 }}>{t('card.days.label')}</span>
          <span style={{ fontSize: fs(17), fontWeight: 800, color: '#263a63', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{daysText}</span>
          <span style={{ fontSize: fs(7), fontWeight: 600, color: '#263a63', lineHeight: 1.2, whiteSpace: 'nowrap', opacity: 0.8 }}>{trendTxt}</span>
        </div>
      </div>

      {/* balance box right under the paws (she clings onto it) */}
      <div style={{ ...glass, borderRadius: fs(13), padding: `${fs(7)}px ${fs(10)}px`, marginTop: '-5%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: fs(4) }}>
          <span style={label(fs(8), 0.75)}>{t('card.balance')}</span>
          <span style={value(fs(14))}>{balance === null ? t('card.error') : `¥${fmtMoney(balance)}`}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: fs(4), marginTop: fs(4) }}>
          <span style={label(fs(8), 0.75)}>{t('card.usage')}</span>
          <span style={value(fs(11), 700)}>{sess === null ? t('card.error') : `¥${fmtMoney(sess.cost)}`}</span>
        </div>
        <div style={label(fs(7), 0.55)}>
          {sess === null ? '' : t('card.usage.value', { in: fmtTokens(sess.input), out: fmtTokens(sess.output) })}
        </div>
        <div style={{ display: 'flex', gap: fs(8), justifyContent: 'center', marginTop: fs(5), alignItems: 'center' }}>
          <span style={label(fs(8), 0.82)}>{t('card.recent7', { v: est === null ? '—' : fmtMoney(est.avgDaily7) })}</span>
          <span style={{ width: 1, height: fs(8), background: 'rgba(255,255,255,0.22)' }} />
          <span style={label(fs(8), 0.82)}>{t('card.recent30', { v: est === null ? '—' : fmtMoney(est.avgDaily30) })}</span>
        </div>
      </div>
    </div>
  )
}
