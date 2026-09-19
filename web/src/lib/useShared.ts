import { useCallback, useEffect, useState } from 'react'
import { quoteUsdcToTry } from './anchor'
import {
  getActivity,
  getHealth,
  getLine,
  getReserves,
  getWalletState,
  type ActivityEvent,
  type Health,
  type Line,
  type ReserveView,
  type WalletState,
} from './chain'
import type { Shared } from './shared'
import { useWallet } from './wallet'

let rateCache: { at: number; value: number } | null = null

export function useShared(): Shared & { events: ActivityEvent[]; allEvents: ActivityEvent[]; loading: boolean } {
  const { address, signer } = useWallet()
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [line, setLine] = useState<Line | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [reserves, setReserves] = useState<{ xlm: ReserveView; usdc: ReserveView } | null>(null)
  const [rate, setRate] = useState<number | null>(rateCache?.value ?? null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!address) {
      setWallet(null)
      setLine(null)
      setHealth(null)
      setEvents([])
      getActivity()
        .then(setAllEvents)
        .catch(() => setAllEvents([]))
      return
    }
    setLoading(true)
    try {
      const [walletState, lineState, healthState, activity] = await Promise.all([
        getWalletState(address),
        getLine(address).catch(() => null),
        getHealth(address).catch(() => null),
        getActivity().catch(() => []),
      ])
      setWallet(walletState)
      setLine(lineState)
      setHealth(healthState)
      setAllEvents(activity)
      setEvents(activity.filter((event) => event.user === address))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    getReserves().then(setReserves).catch(() => setReserves(null))
    if (rateCache && Date.now() - rateCache.at < 60_000) return
    quoteUsdcToTry(1)
      .then((quote) => {
        rateCache = { at: Date.now(), value: quote.buyAmount }
        setRate(quote.buyAmount)
      })
      .catch(() => setRate(null))
  }, [])

  return { signer, wallet, line, health, reserves, rate, refresh, events, allEvents, loading }
}
