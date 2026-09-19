import { xdr } from '@stellar/stellar-sdk'
import type { Point } from '../components/PriceChart'
import { MAINNET_RPC_URLS } from '../config'
import { RpcPool } from './rpc'

export const MAINNET_HORIZON = 'https://horizon.stellar.org'
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
export const FX_ORACLE = 'CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC'
export const MARKET_ORACLE = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN'
export const MAINNET_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
export const SCALE = 1e14
const RESOLUTION = 300
const MAX_RECORDS = 20

const mainnetPool = new RpcPool(MAINNET_RPC_URLS, MAINNET_PASSPHRASE, 3)

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

async function hourlyPrices(contractId: string, code: string, transform: (price: number) => number, hours: number): Promise<Point[]> {
  const now = Math.floor(Date.now() / 1000 / RESOLUTION) * RESOLUTION
  const stamps = Array.from({ length: hours + 1 }, (_, i) => now - (hours - i) * 3600)
  const results = await Promise.all(
    stamps.map(async (stamp) => {
      try {
        const record = (await readMainnet(contractId, 'price', [otherAsset(code), xdr.ScVal.scvU64(BigInt(stamp))])) as PriceRecord | null
        return record ? { t: stamp * 1000, v: transform(Number(record.price) / SCALE) } : null
      } catch {
        return null
      }
    }),
  )
  return results.filter((point): point is Point => point !== null && Number.isFinite(point.v) && point.v > 0)
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

export function getXlmUsdHistory(): Promise<Point[]> {
  return cached('xlm', async () => {
    try {
      const end = Date.now()
      const start = end - 24 * 3600 * 1000
      const params = new URLSearchParams({
        base_asset_type: 'native',
        counter_asset_type: 'credit_alphanum4',
        counter_asset_code: 'USDC',
        counter_asset_issuer: MAINNET_USDC_ISSUER,
        resolution: '900000',
        start_time: String(start),
        end_time: String(end),
        limit: '100',
        order: 'asc',
      })
      const response = await fetch(`${MAINNET_HORIZON}/trade_aggregations?${params}`)
      if (!response.ok) throw new Error('horizon aggregation failed')
      const body = (await response.json()) as { _embedded: { records: { timestamp: string; close: string }[] } }
      const points = body._embedded.records.map((record) => ({ t: Number(record.timestamp), v: Number(record.close) }))
      if (points.length >= 6) return points
    } catch {
      return recentPrices(MARKET_ORACLE, 'XLM', (price) => price)
    }
    return recentPrices(MARKET_ORACLE, 'XLM', (price) => price)
  })
}
