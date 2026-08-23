/**
 * dsh-balance — browser half. Registers the floating balance card into the
 * global `shell.overlay` slot and the "adjust size" settings card into the
 * "设置 → 插件配置" section (`settings.plugin.item`, keyed by the namespace).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { BalanceCard } from './BalanceCard.tsx'
import { BalanceSettingsCard } from './BalanceSettingsCard.tsx'
import { BalanceSettingsCardController, BALANCE_NS } from './balance-settings-controller.ts'
import { en, NS, zh } from './locales.ts'

export type { BalanceCardProps } from './BalanceCard.tsx'
export type { BalanceSettingsCardProps } from './BalanceSettingsCard.tsx'

/** Required services for locale registration, the overlay slot, and the settings scope. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body: register the dictionaries, the overlay card, and the
 * settings card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-balance: dictionaries')

  ctx.slots.inject(
    'shell.overlay',
    () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-balance',
      order: 1,
      locale: NS,
    }, BalanceCard),
  )

  const settingsCard = new BalanceSettingsCardController(ctx.settingsScope.bind({ namespace: BALANCE_NS }))
  ctx.slots.inject(
    'settings.plugin.item',
    function* () {
      yield ctx.slots.register({
        name: 'settings.plugin.item',
        key: BALANCE_NS,
        locale: NS,
        inject: () => settingsCard.inject(),
      }, BalanceSettingsCard)
    },
  )
}
