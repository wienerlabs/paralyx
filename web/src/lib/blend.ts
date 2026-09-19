import { Address, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
import { BLEND_ORACLE, BLEND_POOL, BLEND_USDC_SAC, CREDIT_LINE_CONTRACT, NETWORK_PASSPHRASE, READ_SOURCE_ACCOUNT, RPC_URL, XLM_SAC } from '../config'
import type { TokenSymbol } from '../components/TokenIcon'

const server = new rpc.Server(RPC_URL)
const SEVEN = 10_000_000
const TWELVE = 1_000_000_000_000

export const WETH_SAC = 'CAZAQB3D7KSLSNOSQKYD2V4JP5V2Y3B4RDJZRLBFCCIXDCTE3WHSY3UE'
export const WBTC_SAC = 'CAP5AMC2OHNVREO66DFIN6DHJMPOBAJ2KCDDIMFBR7WWJH5RZBFM3UEI'

const reserveList: { asset: string; symbol: TokenSymbol; label: string }[] = [
  { asset: XLM_SAC, symbol: 'XLM', label: 'XLM' },
  { asset: BLEND_USDC_SAC, symbol: 'USDC', label: 'USDC' },
  { asset: WETH_SAC, symbol: 'ETH', label: 'wETH' },
  { asset: WBTC_SAC, symbol: 'BTC', label: 'wBTC' },
]

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
}

async function read(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const account = await server.getAccount(READ_SOURCE_ACCOUNT)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error(`read failed: ${method}`)
  return scValToNative(sim.result.retval)
}

interface RawReserve {
  config: { c_factor: number; l_factor: number; util: number; max_util: number; r_base: number; r_one: number; r_two: number; r_three: number }
  data: { b_rate: bigint; d_rate: bigint; b_supply: bigint; d_supply: bigint; ir_mod: bigint }
}

function borrowRate(config: RawReserve['config'], irMod: number, utilization: number): number {
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
  const config = (await read(BLEND_POOL, 'get_config', [])) as { bstop_rate: number }
  const backstopRate = Number(config.bstop_rate) / SEVEN
  const lineCount = Number(await read(CREDIT_LINE_CONTRACT, 'get_line_count', []).catch(() => 0))
  const rows = await Promise.all(
    reserveList.map(async (entry): Promise<ReserveRow> => {
      const raw = (await read(BLEND_POOL, 'get_reserve', [new Address(entry.asset).toScVal()])) as RawReserve
      const priceRaw = (await read(BLEND_ORACLE, 'lastprice', [
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Stellar'), new Address(entry.asset).toScVal()]),
      ])) as { price: bigint } | null
      const price = priceRaw ? Number(priceRaw.price) / SEVEN : 0
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
  }
}

