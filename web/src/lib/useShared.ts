import { useCallback } from 'react'
import { quoteUsdcToTry } from './anchor'
import { getActivity, getHealth, getLine, getReserves, getWalletState, type ActivityEvent } from './chain'
import type { Shared } from './shared'
import { useWallet } from './wallet'
import { CREDIT_LINE_CONTRACT, HAS_SANDBOX_ANCHOR } from '../config'
import { useLivePrices } from './prices'
import { getPoolStatus } from './blend'
import { useCached } from './store'

const EMPTY: ActivityEvent[] = []

export function useShared(): Shared & { events: ActivityEvent[]; allEvents: ActivityEvent[]; loading: boolean } {
  const { address, signer } = useWallet()
  const live = useLivePrices()
  const wallet = useCached(address ? `wallet:${address}` : null, () => getWalletState(address ?? ''), { ttl: 15_000, persist: true, refreshMs: 30_000 })
  const line = useCached(address && CREDIT_LINE_CONTRACT ? `line:${address}` : null, () => getLine(address ?? ''), { ttl: 30_000, persist: true })
  const health = useCached(address ? `health:${address}` : null, () => getHealth(address ?? ''), { ttl: 30_000, persist: true, refreshMs: 30_000 })
  const reserves = useCached('reserves', getReserves, { ttl: 60_000, persist: true })
  const status = useCached('poolStatus', getPoolStatus, { ttl: 60_000, persist: true, refreshMs: 60_000 })
  const rate = useCached(HAS_SANDBOX_ANCHOR ? 'rate' : null, () => quoteUsdcToTry(1).then((quote) => quote.buyAmount), { ttl: 60_000, persist: true })
  const events = useCached(CREDIT_LINE_CONTRACT ? 'events' : null, getActivity, { ttl: 20_000, persist: true, refreshMs: 30_000 })

  const refresh = useCallback(async () => {
    await Promise.all([wallet.refresh(), line.refresh(), health.refresh(), events.refresh(), status.refresh()])
  }, [wallet, line, health, events, status])

  const allEvents = events.data ?? EMPTY
  return {
    signer,
    wallet: wallet.data ?? null,
    line: line.data ?? null,
    health: health.data ?? null,
    reserves: reserves.data ?? null,
    rate: HAS_SANDBOX_ANCHOR ? (rate.data ?? null) : live.tryPerUsd,
    poolStatus: status.data ?? null,
    refresh,
    events: address ? allEvents.filter((event) => event.user === address) : EMPTY,
    allEvents,
    loading: wallet.loading || line.loading || health.loading,
  }
}
