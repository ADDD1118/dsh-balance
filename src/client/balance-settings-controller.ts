/** Booking namespace + a minimal controller bridging the settings scope onto the card. */
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'

/** The settings namespace this card edits (spelled here, not imported). */
export const BALANCE_NS = 'dsh-balance'

/** The section this card edits. */
export interface BalanceSettings { width?: number }

/** The registration-side face the card's slot entry injects. */
export interface BalanceSettingsCardInjected {
  /** Read the current (effective) width from the namespace section. */
  getWidth: () => number | undefined
  /** Persist a new width into the namespace section. */
  setWidth: (value: number) => Promise<void>
}

/** Bridges the `dsh-balance` settings scope onto the card's actions. */
export class BalanceSettingsCardController {
  constructor(private readonly scope: SettingsScope<BalanceSettings>) {}

  inject(): BalanceSettingsCardInjected {
    return {
      getWidth: () => (this.scope.getSnapshot().value as BalanceSettings | undefined)?.width,
      setWidth: (value) => this.scope.set('width', value),
    }
  }
}
