import { useEffect, useState } from 'react'
import { readMainnet, otherAsset, FX_ORACLE, MARKET_ORACLE, MAINNET_HORIZON, MAINNET_USDC_ISSUER, SCALE } from './reflector'

export interface LivePrices {
  tryPerUsd: number | null
  xlmUsd: number | null
  updatedAt: number | null
}

async function fetchTryPerUsd(): Promise<number | null> {
  const record = (await readMainnet(FX_ORACLE, 'lastprice', [otherAsset('TRY')])) as { price: bigint } | null
  if (!record) return null
  const price = Number(record.price) / SCALE
  return price > 0 ? 1 / price : null
}

async function fetchXlmUsd(): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      selling_asset_type: 'native',
      buying_asset_type: 'credit_alphanum4',
      buying_asset_code: 'USDC',
      buying_asset_issuer: MAINNET_USDC_ISSUER,
      limit: '1',
    })
    const response = await fetch(`${MAINNET_HORIZON}/order_book?${params}`)
    if (!response.ok) throw new Error('order book failed')
    const book = (await response.json()) as { bids: { price: string }[]; asks: { price: string }[] }
    const bid = Number(book.bids[0]?.price)
    const ask = Number(book.asks[0]?.price)
    if (bid > 0 && ask > 0) return (bid + ask) / 2
  } catch {
    return fetchXlmFromOracle()
  }
  return fetchXlmFromOracle()
}

async function fetchXlmFromOracle(): Promise<number | null> {
  const record = (await readMainnet(MARKET_ORACLE, 'lastprice', [otherAsset('XLM')])) as { price: bigint } | null
  return record ? Number(record.price) / SCALE : null
}

let shared: LivePrices = { tryPerUsd: null, xlmUsd: null, updatedAt: null }
const listeners = new Set<(prices: LivePrices) => void>()
let timer: ReturnType<typeof setInterval> | null = null

async function tick(): Promise<void> {
  const [tryPerUsd, xlmUsd] = await Promise.all([fetchTryPerUsd().catch(() => shared.tryPerUsd), fetchXlmUsd().catch(() => shared.xlmUsd)])
  shared = { tryPerUsd, xlmUsd, updatedAt: Date.now() }
  listeners.forEach((listener) => listener(shared))
}

function ensurePolling(intervalMs: number): void {
  if (timer) return
  void tick()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void tick()
  }, intervalMs)
}

export function useLivePrices(intervalMs = 15_000): LivePrices {
  const [prices, setPrices] = useState<LivePrices>(shared)
  useEffect(() => {
    listeners.add(setPrices)
    ensurePolling(intervalMs)
    return () => {
      listeners.delete(setPrices)
    }
  }, [intervalMs])
  return prices
}
