import { xdr } from '@stellar/stellar-sdk'
import type { Point } from '../components/PriceChart'
import { MAINNET_RPC_URLS } from '../config'
import { RpcPool } from './rpc'

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type XlmRange = '24h' | '7d' | '30d'

const XLM_RANGES: Record<XlmRange, { resolution: number; span: number }> = {
  '24h': { resolution: 900_000, span: 24 * 3_600_000 },
  '7d': { resolution: 3_600_000, span: 7 * 86_400_000 },
  '30d': { resolution: 86_400_000, span: 30 * 86_400_000 },
}

export const MAINNET_HORIZON = 'https://horizon.stellar.org'
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
export const FX_ORACLE = 'CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC'
export const MARKET_ORACLE = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN'
export const MAINNET_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
export const SCALE = 1e14
const RESOLUTION = 300
const MAX_RECORDS = 20

const mainnetPool = new RpcPool(MAINNET_RPC_URLS, MAINNET_PASSPHRASE, 6)

interface PriceRecord {
  price: bigint
  timestamp: bigint
}

export function readMainnet(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  return mainnetPool.simulate(contractId, method, args)
}

export function otherAsset(code: string): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(code)])
}

function toPoint(record: PriceRecord, transform: (price: number) => number): Point {
  return { t: Number(record.timestamp) * 1000, v: transform(Number(record.price) / SCALE) }
}

async function recentPrices(contractId: string, code: string, transform: (price: number) => number): Promise<Point[]> {
  const raw = (await readMainnet(contractId, 'prices', [otherAsset(code), xdr.ScVal.scvU32(MAX_RECORDS)])) as PriceRecord[] | null
  if (!raw) return []
  return raw.map((record) => toPoint(record, transform)).reverse()
}

function hourlyStoreKey(code: string): string {
  return `paralyx:reflector:${code}:hourly`
}

function readHourly(code: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(hourlyStoreKey(code))
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function writeHourly(code: string, values: Record<string, number>, keepAfter: number): void {
  try {
    const pruned: Record<string, number> = {}
    for (const [stamp, value] of Object.entries(values)) if (Number(stamp) >= keepAfter) pruned[stamp] = value
    localStorage.setItem(hourlyStoreKey(code), JSON.stringify(pruned))
  } catch {
    return
  }
}

async function hourlyPrices(contractId: string, code: string, transform: (price: number) => number, hours: number): Promise<Point[]> {
  const now = Math.floor(Date.now() / 1000 / RESOLUTION) * RESOLUTION
  const stamps = Array.from({ length: hours + 1 }, (_, i) => now - (hours - i) * 3600)
  const known = readHourly(code)
  const missing = stamps.filter((stamp) => known[String(stamp)] === undefined)
  await Promise.all(
    missing.map(async (stamp) => {
      try {
        const record = (await readMainnet(contractId, 'price', [otherAsset(code), xdr.ScVal.scvU64(BigInt(stamp))])) as PriceRecord | null
        if (record) known[String(stamp)] = Number(record.price)
      } catch {
        return
      }
    }),
  )
  writeHourly(code, known, now - 48 * 3600)
  return stamps
    .filter((stamp) => known[String(stamp)] !== undefined)
    .map((stamp) => ({ t: stamp * 1000, v: transform(known[String(stamp)] / SCALE) }))
    .filter((point) => Number.isFinite(point.v) && point.v > 0)
}

const cache = new Map<string, { at: number; points: Point[] }>()

async function cached(key: string, loader: () => Promise<Point[]>): Promise<Point[]> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 120_000) return hit.points
  const points = await loader()
  cache.set(key, { at: Date.now(), points })
  return points
}

export function getTryPerUsdHistory(): Promise<Point[]> {
  return cached('try', async () => {
    const transform = (price: number) => 1 / price
    const hourly = await hourlyPrices(FX_ORACLE, 'TRY', transform, 24)
    if (hourly.length >= 6) return hourly
    return recentPrices(FX_ORACLE, 'TRY', transform)
  })
}

const candleCache = new Map<string, { at: number; candles: Candle[] }>()

export async function getXlmCandles(range: XlmRange): Promise<Candle[]> {
  const hit = candleCache.get(range)
  if (hit && Date.now() - hit.at < 120_000) return hit.candles
  const { resolution, span } = XLM_RANGES[range]
  const end = Math.floor(Date.now() / resolution) * resolution
  const start = end - span
  const params = new URLSearchParams({
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: MAINNET_USDC_ISSUER,
    resolution: String(resolution),
    start_time: String(start),
    end_time: String(end + resolution),
    limit: '200',
    order: 'asc',
  })
  const response = await fetch(`${MAINNET_HORIZON}/trade_aggregations?${params}`)
  if (!response.ok) throw new Error('horizon aggregation failed')
  const body = (await response.json()) as { _embedded: { records: { timestamp: string; open: string; high: string; low: string; close: string; base_volume: string }[] } }
  const candles = body._embedded.records
    .map((record) => ({ t: Number(record.timestamp), o: Number(record.open), h: Number(record.high), l: Number(record.low), c: Number(record.close), v: Number(record.base_volume) }))
    .filter((candle) => Number.isFinite(candle.c) && candle.c > 0)
  candleCache.set(range, { at: Date.now(), candles })
  return candles
}

export function getXlmUsdHistory(): Promise<Point[]> {
  return getXlmCandles('24h').then((candles) => candles.map((candle) => ({ t: candle.t, v: candle.c })))
}
