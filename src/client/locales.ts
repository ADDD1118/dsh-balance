/** dsh-balance browser copy. Product copy is Chinese; English mirrors it. */
export const NS = 'dsh-balance'

export const zh = {
  'card.days': '预计可用天数',
  'card.days.label': '预计可用',
  'card.days.value': '{v} 天',
  'card.days.unlimited': '充足',
  'card.balance': '当前余额',
  'card.usage': '当前任务消耗',
  'card.usage.value': '输入 {in} · 输出 {out}',
  'card.cost': '消耗 ¥{cost}',
  'card.recent7': '近7天日均 ¥{v}',
  'card.recent30': '近30天日均 ¥{v}',
  'card.weighted': '加权日均 ¥{v}',
  'card.trend.up': '↑ 用量上升',
  'card.trend.down': '↓ 用量下降',
  'card.trend.flat': '— 用量平稳',
  'card.error': '—',
  'settings.width': '卡片宽度',
  'settings.widthHint': '范围 100–400 px，保存后刷新可见大小变化。',
  'settings.save': '保存',
  'settings.saved': '已保存',
} as const

export const en = {
  'card.days': 'Est. days left',
  'card.days.label': 'Est. days',
  'card.days.value': '{v} days',
  'card.days.unlimited': 'Plenty',
  'card.balance': 'Balance',
  'card.usage': 'Current task',
  'card.usage.value': 'In {in} · Out {out}',
  'card.cost': 'Cost ¥{cost}',
  'card.recent7': '7d avg ¥{v}',
  'card.recent30': '30d avg ¥{v}',
  'card.weighted': 'Wtd avg ¥{v}',
  'card.trend.up': '↑ rising',
  'card.trend.down': '↓ falling',
  'card.trend.flat': '— flat',
  'card.error': '—',
  'settings.width': 'Card width',
  'settings.widthHint': 'Range 100–400 px; refresh to see the size change.',
  'settings.save': 'Save',
  'settings.saved': 'Saved',
} as const

export type BalanceKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-balance card copy. */
    'dsh-balance': BalanceKey
  }
}
