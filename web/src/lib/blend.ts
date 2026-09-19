import type { xdr } from '@stellar/stellar-sdk'
import { BLEND_POOL, CREDIT_LINE_CONTRACT, NETWORK } from '../config'
import type { TokenSymbol } from '../components/TokenIcon'
import { fetchReserveRaw, pool as rpcPool } from './chain'

const SEVEN = 10_000_000
const TWELVE = 1_000_000_000_000

const reserveList: { asset: string; symbol: TokenSymbol; label: string }[] = NETWORK.reserves

export interface ReserveRow {
  asset: string
  symbol: TokenSymbol
  label: string
  price: number
  supplied: number
  borrowed: number
  suppliedUsd: number
  borrowedUsd: number
  utilization: number
  borrowApr: number
  supplyApr: number
  cFactor: number
  lFactor: number
}

export interface PoolOverview {
  reserves: ReserveRow[]
  totalSuppliedUsd: number
  totalBorrowedUsd: number
  utilization: number
  lineCount: number
  backstopRate: number
  status: number
}

export type PoolStatusKey = 'poolStatusActive' | 'poolStatusOnIce' | 'poolStatusFrozen' | 'poolStatusSetup'

export function poolStatusKey(status: number): PoolStatusKey {
  if (status <= 1) return 'poolStatusActive'
  if (status <= 3) return 'poolStatusOnIce'
  if (status <= 5) return 'poolStatusFrozen'
  return 'poolStatusSetup'
}

export function borrowAllowed(status: number | null): boolean {
  return status !== null && status <= 1
}

export function supplyAllowed(status: number | null): boolean {
  return status !== null && status <= 3
}

let statusCache: { at: number; value: number } | null = null

export async function getPoolStatus(): Promise<number> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value
  const config = (await read(BLEND_POOL, 'get_config', [])) as { status: number }
  const value = Number(config.status)
  statusCache = { at: Date.now(), value }
  return value
}

function read(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  return rpcPool.simulate(contractId, method, args)
}

function borrowRate(config: { util: number; r_base: number; r_one: number; r_two: number; r_three: number }, irMod: number, utilization: number): number {
  const target = config.util / SEVEN
  const base = config.r_base / SEVEN
  const one = config.r_one / SEVEN
  const two = config.r_two / SEVEN
  const three = config.r_three / SEVEN
  if (utilization <= target) return irMod * (base + (utilization / Math.max(target, 1e-9)) * one)
  if (utilization <= 0.95) return irMod * (base + one + ((utilization - target) / Math.max(0.95 - target, 1e-9)) * two)
  return irMod * (base + one + two) + ((utilization - 0.95) / 0.05) * three
}

export async function getPoolOverview(): Promise<PoolOverview> {
  const config = (await read(BLEND_POOL, 'get_config', [])) as { bstop_rate: number; status: number }
  const backstopRate = Number(config.bstop_rate) / SEVEN
  statusCache = { at: Date.now(), value: Number(config.status) }
  const lineCount = CREDIT_LINE_CONTRACT ? Number(await read(CREDIT_LINE_CONTRACT, 'get_line_count', []).catch(() => 0)) : 0
  const rows = await Promise.all(
    reserveList.map(async (entry): Promise<ReserveRow> => {
      const { raw, price } = await fetchReserveRaw(entry.asset)
      const supplied = Number((BigInt(raw.data.b_supply) * BigInt(raw.data.b_rate)) / BigInt(TWELVE)) / SEVEN
      const borrowed = Number((BigInt(raw.data.d_supply) * BigInt(raw.data.d_rate)) / BigInt(TWELVE)) / SEVEN
      const utilization = supplied > 0 ? Math.min(1, borrowed / supplied) : 0
      const irMod = Number(raw.data.ir_mod) / SEVEN
      const borrowApr = borrowRate(raw.config, irMod, utilization)
      const supplyApr = borrowApr * utilization * (1 - backstopRate)
      return {
        asset: entry.asset,
        symbol: entry.symbol,
        label: entry.label,
        price,
        supplied,
        borrowed,
        suppliedUsd: supplied * price,
        borrowedUsd: borrowed * price,
        utilization,
        borrowApr,
        supplyApr,
        cFactor: Number(raw.config.c_factor) / SEVEN,
        lFactor: Number(raw.config.l_factor) / SEVEN,
      }
    }),
  )
  const totalSuppliedUsd = rows.reduce((sum, row) => sum + row.suppliedUsd, 0)
  const totalBorrowedUsd = rows.reduce((sum, row) => sum + row.borrowedUsd, 0)
  return {
    reserves: rows,
    totalSuppliedUsd,
    totalBorrowedUsd,
    utilization: totalSuppliedUsd > 0 ? totalBorrowedUsd / totalSuppliedUsd : 0,
    lineCount,
    backstopRate,
    status: Number(config.status),
  }
}

