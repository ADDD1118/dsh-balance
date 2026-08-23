/**
 * The floating balance card — a compact widget. The cut-out girl (transparent
 * background + bubble) is on top and her paws rest right on the liquid-glass
 * balance box, so she appears to cling onto it. The estimated-days value lives
 * in a small glass chip inside the speech bubble (top-left).
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

function restorePos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_STORE)
    if (raw !== null) {
      const p = JSON.parse(raw) as { x?: number; y?: number }
      if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
    }
  } catch { /* ignore */ }
  return { x: Math.max(8, window.innerWidth - W - 14), y: 60 }
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
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Every font/layout pixel scales with the configured card width.
  const scale = width / 200
  const fs = (size: number): number => Math.round(size * scale)

  // Clamp the card inside the viewport and snap it to the nearest edge when
  // it is dragged close. Keeps the widget reachable when the browser moves to
  // a smaller/differently-sized display.
  const clampAndSnap = useCallback((x: number, y: number): { x: number; y: number } => {
    const h = cardRef.current?.offsetHeight ?? 260
    const vw = window.innerWidth
    const vh = window.innerHeight
    let cx = Math.max(0, Math.min(x, vw - width))
    let cy = Math.max(0, Math.min(y, vh - h))
    const edge = 16
    if (cx <= edge) cx = 0
    else if (cx >= vw - width - edge) cx = vw - width
    if (cy <= edge) cy = 0
    else if (cy >= vh - h - edge) cy = vh - h
    return { x: Math.round(cx), y: Math.round(cy) }
  }, [width])

  // On mount, re-clamp a saved position into the current viewport (the saved
  // spot may be off-screen after the window moved to another monitor).
  useEffect(() => {
    const p = clampAndSnap(pos.x, pos.y)
    if (p.x !== pos.x || p.y !== pos.y) {
      setPos(p)
      try { localStorage.setItem(POS_STORE, JSON.stringify(p)) } catch { /* ignore */ }
    }
  }, [clampAndSnap])

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
    pointer.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }, [pos.x, pos.y])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current === null) return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setPos(clampAndSnap(e.clientX - pointer.current.x, e.clientY - pointer.current.y))
  }, [clampAndSnap])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current === null) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    pointer.current = null
    const p = clampAndSnap(pos.x, pos.y)
    setPos(p)
    try { localStorage.setItem(POS_STORE, JSON.stringify(p)) } catch { /* ignore */ }
  }, [pos, clampAndSnap])

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
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1050, width, pointerEvents: 'auto', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
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
