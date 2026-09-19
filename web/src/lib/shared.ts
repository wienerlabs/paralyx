import { useState } from 'react'
import { EXPLORER_TX } from '../config'
import type { Health, Line, ReserveView, Signer, WalletState } from './chain'
import { useT, type DictKey } from './i18n'
import type { Step } from '../components/Steps'

export interface Shared {
  signer: Signer | null
  wallet: WalletState | null
  line: Line | null
  health: Health | null
  reserves: { xlm: ReserveView; usdc: ReserveView } | null
  rate: number | null
  poolStatus: number | null
  refresh: () => Promise<void>
}

export type Mark = (index: number, state: Step['state'], detail?: string) => void

export function txLink(hash: string): string {
  return `${EXPLORER_TX}${hash}`
}

export function useFlow() {
  const { t } = useT()
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mark: Mark = (index, state, detail) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, state, detail: detail ?? step.detail } : step)))
  const run = async (labels: DictKey[], fn: (mark: Mark) => Promise<void>) => {
    setError(null)
    setBusy(true)
    setSteps(labels.map((label) => ({ label: t(label), state: 'pending' })))
    try {
      await fn(mark)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setSteps((current) => {
        const active = current.findIndex((step) => step.state === 'active')
        return current.map((step, i) => (i === active ? { ...step, state: 'failed' } : step))
      })
    } finally {
      setBusy(false)
    }
  }
  const reset = () => {
    setSteps([])
    setError(null)
  }
  return { steps, busy, error, run, reset }
}
