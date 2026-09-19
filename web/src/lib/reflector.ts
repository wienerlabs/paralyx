import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
import type { Point } from '../components/PriceChart'

const MAINNET_RPC = 'https://mainnet.sorobanrpc.com'
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
const FX_ORACLE = 'CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC'
const MARKET_ORACLE = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN'
const SCALE = 1e14

const server = new rpc.Server(MAINNET_RPC)
const source = new Account(Keypair.random().publicKey(), '0')

interface PriceRecord {
  price: bigint
  timestamp: bigint
}

async function read(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: MAINNET_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error(`reflector read failed: ${method}`)
  return scValToNative(sim.result.retval)
}

function other(code: string): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(code)])
}

async function history(contractId: string, code: string, transform: (price: number) => number): Promise<Point[]> {
  for (const records of [288, 96, 24]) {
    try {
      const raw = (await read(contractId, 'prices', [other(code), xdr.ScVal.scvU32(records)])) as PriceRecord[] | null
      if (!raw || raw.length === 0) continue
      return raw
        .map((record) => ({ t: Number(record.timestamp) * 1000, v: transform(Number(record.price) / SCALE) }))
        .filter((point) => Number.isFinite(point.v) && point.v > 0)
        .reverse()
    } catch {
      continue
    }
  }
  return []
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
  return cached('try', () => history(FX_ORACLE, 'TRY', (price) => 1 / price))
}

export function getXlmUsdHistory(): Promise<Point[]> {
  return cached('xlm', () => history(MARKET_ORACLE, 'XLM', (price) => price))
}
