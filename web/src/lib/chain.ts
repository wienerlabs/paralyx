import { Address, Asset, Contract, Horizon, Memo, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
import { RpcPool } from './rpc'
import {
  BLEND_ORACLE,
  BLEND_POOL,
  BLEND_USDC_ISSUER,
  BLEND_USDC_SAC,
  CIRCLE_USDC_ISSUER,
  CREDIT_LINE_CONTRACT,
  FRIENDBOT_URL,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  RPC_URLS,
  SAFETY_BUFFER,
  USDT0_ISSUER,
  XLM_SAC,
} from '../config'

export interface Signer {
  address: string
  sign: (xdr: string) => Promise<string>
}

export interface Line {
  opened_at: bigint
  updated_at: bigint
  collateral_in: bigint
  collateral_out: bigint
  borrowed: bigint
  repaid: bigint
  payouts: number
  payout_try: bigint
}

export interface ReserveView {
  index: number
  cFactor: number
  lFactor: number
  bRate: bigint
  dRate: bigint
  price: number
}

export interface Health {
  collateralXlm: number
  debtUsdc: number
  collateralValueUsd: number
  liabilityValueUsd: number
  borrowableUsdc: number
  healthFactor: number | null
  xlmPrice: number
}

export const pool = new RpcPool(RPC_URLS, NETWORK_PASSPHRASE, 4)
export const server = pool.primary
export const horizon = new Horizon.Server(HORIZON_URL)
export const blendUsdcAsset = new Asset('USDC', BLEND_USDC_ISSUER)
export const circleUsdcAsset = new Asset('USDC', CIRCLE_USDC_ISSUER)
export const usdt0Asset = USDT0_ISSUER ? new Asset('USDT0', USDT0_ISSUER) : null

const SEVEN = 10_000_000
const TWELVE = 1_000_000_000_000
const INCLUSION_FEE = '2000'

export function toStroops(amount: string | number): bigint {
  const [whole, fraction = ''] = String(amount).trim().replace(',', '.').split('.')
  const digits = (fraction + '0000000').slice(0, 7)
  const sign = whole.startsWith('-') ? -1n : 1n
  return sign * (BigInt(whole.replace('-', '') || '0') * 10_000_000n + BigInt(digits))
}

export function fromStroops(value: bigint | number | string, decimals = 2): string {
  const n = Number(BigInt(value)) / SEVEN
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatAmount(n: number, decimals = 2): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function addressArg(value: string): xdr.ScVal {
  return new Address(value).toScVal()
}

function i128Arg(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' })
}

function simulateRead(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  return pool.simulate(contractId, method, args)
}

export async function getLine(user: string): Promise<Line | null> {
  const result = (await simulateRead(CREDIT_LINE_CONTRACT, 'get_line', [addressArg(user)])) as Line | null | undefined
  return result ?? null
}

export async function getLineCount(): Promise<number> {
  return Number(await simulateRead(CREDIT_LINE_CONTRACT, 'get_line_count', []))
}

interface RawPositions {
  collateral: Record<string, bigint>
  liabilities: Record<string, bigint>
  supply: Record<string, bigint>
}

export async function getPositions(user: string): Promise<RawPositions> {
  const result = (await simulateRead(BLEND_POOL, 'get_positions', [addressArg(user)])) as RawPositions
  return {
    collateral: result?.collateral ?? {},
    liabilities: result?.liabilities ?? {},
    supply: result?.supply ?? {},
  }
}

async function getReserve(asset: string): Promise<ReserveView> {
  const raw = (await simulateRead(BLEND_POOL, 'get_reserve', [addressArg(asset)])) as {
    config: { c_factor: number; l_factor: number; index: number }
    data: { b_rate: bigint; d_rate: bigint }
  }
  const priceRaw = (await simulateRead(BLEND_ORACLE, 'lastprice', [
    xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Stellar'), addressArg(asset)]),
  ])) as { price: bigint } | null
  return {
    index: Number(raw.config.index),
    cFactor: Number(raw.config.c_factor) / SEVEN,
    lFactor: Number(raw.config.l_factor) / SEVEN,
    bRate: BigInt(raw.data.b_rate),
    dRate: BigInt(raw.data.d_rate),
    price: priceRaw ? Number(priceRaw.price) / SEVEN : 0,
  }
}

let reserveCache: { at: number; xlm: ReserveView; usdc: ReserveView } | null = null

export async function getReserves(): Promise<{ xlm: ReserveView; usdc: ReserveView }> {
  if (reserveCache && Date.now() - reserveCache.at < 60_000) return reserveCache
  const [xlm, usdc] = await Promise.all([getReserve(XLM_SAC), getReserve(BLEND_USDC_SAC)])
  reserveCache = { at: Date.now(), xlm, usdc }
  return reserveCache
}

function underlying(shares: bigint, rate: bigint): number {
  return Number((shares * rate) / BigInt(TWELVE)) / SEVEN
}

export async function getHealth(user: string): Promise<Health> {
  const [positions, reserves] = await Promise.all([getPositions(user), getReserves()])
  const collateralShares = BigInt(positions.collateral[String(reserves.xlm.index)] ?? 0)
  const debtShares = BigInt(positions.liabilities[String(reserves.usdc.index)] ?? 0)
  const collateralXlm = underlying(collateralShares, reserves.xlm.bRate)
  const debtUsdc = underlying(debtShares, reserves.usdc.dRate)
  const collateralValueUsd = collateralXlm * reserves.xlm.price * reserves.xlm.cFactor
  const liabilityValueUsd = debtUsdc * reserves.usdc.price / reserves.usdc.lFactor
  const headroom = Math.max(0, collateralValueUsd - liabilityValueUsd)
  const borrowableUsdc = (headroom * reserves.usdc.lFactor / reserves.usdc.price) * SAFETY_BUFFER
  return {
    collateralXlm,
    debtUsdc,
    collateralValueUsd,
    liabilityValueUsd,
    borrowableUsdc,
    healthFactor: liabilityValueUsd > 0 ? collateralValueUsd / liabilityValueUsd : null,
    xlmPrice: reserves.xlm.price,
  }
}

export function previewBorrowable(collateralXlm: number, xlm: ReserveView, usdc: ReserveView, existing: Health): number {
  const collateralValue = existing.collateralValueUsd + collateralXlm * xlm.price * xlm.cFactor
  const headroom = Math.max(0, collateralValue - existing.liabilityValueUsd)
  return (headroom * usdc.lFactor / usdc.price) * SAFETY_BUFFER
}

async function waitForTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await pool.run((s) => s.getTransaction(hash))
    if (response.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) return response
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('transaction did not settle in time')
}

export async function invokeCreditLine(signer: Signer, method: string, args: xdr.ScVal[]): Promise<string> {
  const account = await pool.run((s) => s.getAccount(signer.address))
  const tx = new TransactionBuilder(account, { fee: INCLUSION_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(CREDIT_LINE_CONTRACT).call(method, ...args))
    .setTimeout(180)
    .build()
  const prepared = await pool.run((s) => s.prepareTransaction(tx))
  const signedXdr = await signer.sign(prepared.toXDR())
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  const sent = await pool.run((s) => s.sendTransaction(signed))
  if (sent.status === 'ERROR') {
    throw new Error(`send failed: ${sent.errorResult?.toXDR('base64') ?? 'unknown'}`)
  }
  const settled = await waitForTransaction(sent.hash)
  if (settled.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`transaction failed on chain: ${sent.hash}`)
  }
  return sent.hash
}

export function openLine(signer: Signer, collateralXlm: bigint, borrowUsdc: bigint): Promise<string> {
  return invokeCreditLine(signer, 'open_line', [addressArg(signer.address), i128Arg(collateralXlm), i128Arg(borrowUsdc)])
}

export function repayLine(signer: Signer, repayUsdc: bigint, withdrawXlm: bigint): Promise<string> {
  return invokeCreditLine(signer, 'repay_line', [addressArg(signer.address), i128Arg(repayUsdc), i128Arg(withdrawXlm)])
}

export function recordPayout(signer: Signer, anchorTxId: string, tryKurus: bigint): Promise<string> {
  return invokeCreditLine(signer, 'record_payout', [
    addressArg(signer.address),
    nativeToScVal(anchorTxId, { type: 'string' }),
    i128Arg(tryKurus),
  ])
}

export interface WalletState {
  exists: boolean
  xlm: number
  blendUsdc: number | null
  circleUsdc: number | null
  usdt0: number | null
}

export async function getWalletState(address: string): Promise<WalletState> {
  try {
    const account = await horizon.loadAccount(address)
    const find = (asset: Asset) =>
      account.balances.find(
        (b) => 'asset_code' in b && b.asset_code === asset.getCode() && 'asset_issuer' in b && b.asset_issuer === asset.getIssuer(),
      )
    const native = account.balances.find((b) => b.asset_type === 'native')
    const blend = find(blendUsdcAsset)
    const circle = find(circleUsdcAsset)
    const usdt0 = usdt0Asset ? find(usdt0Asset) : undefined
    return {
      exists: true,
      xlm: native ? Number(native.balance) : 0,
      blendUsdc: blend ? Number(blend.balance) : null,
      circleUsdc: circle ? Number(circle.balance) : null,
      usdt0: usdt0 ? Number(usdt0.balance) : null,
    }
  } catch {
    return { exists: false, xlm: 0, blendUsdc: null, circleUsdc: null, usdt0: null }
  }
}

export interface DestinationCheck {
  exists: boolean
  memoRequired: boolean
}

export async function checkDestination(address: string): Promise<DestinationCheck> {
  try {
    const account = await horizon.loadAccount(address)
    const attributes = (account as unknown as { data_attr?: Record<string, string> }).data_attr ?? {}
    return { exists: true, memoRequired: attributes['config.memo_required'] !== undefined }
  } catch {
    return { exists: false, memoRequired: false }
  }
}

export async function fundWithFriendbot(address: string): Promise<void> {
  if (!FRIENDBOT_URL) throw new Error('friendbot is testnet only')
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`)
  if (!response.ok) throw new Error('friendbot refused the request')
}

async function submitClassic(signer: Signer, operations: xdr.Operation[], memo?: Memo): Promise<string> {
  const account = await horizon.loadAccount(signer.address)
  const builder = new TransactionBuilder(account, { fee: '10000', networkPassphrase: NETWORK_PASSPHRASE })
  operations.forEach((operation) => builder.addOperation(operation))
  if (memo) builder.addMemo(memo)
  const tx = builder.setTimeout(180).build()
  const signedXdr = await signer.sign(tx.toXDR())
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  const result = await horizon.submitTransaction(signed)
  return result.hash
}

export async function ensureTrustlines(signer: Signer, state: WalletState, includeUsdt0 = false): Promise<string | null> {
  const operations: xdr.Operation[] = []
  if (state.blendUsdc === null) operations.push(Operation.changeTrust({ asset: blendUsdcAsset }))
  const sameUsdc = circleUsdcAsset.getIssuer() === blendUsdcAsset.getIssuer()
  if (!sameUsdc && state.circleUsdc === null) operations.push(Operation.changeTrust({ asset: circleUsdcAsset }))
  if (includeUsdt0 && usdt0Asset && state.usdt0 === null) operations.push(Operation.changeTrust({ asset: usdt0Asset }))
  if (operations.length === 0) return null
  return submitClassic(signer, operations)
}

export async function quoteStrictSend(sendAsset: Asset, amount: string, destAsset: Asset): Promise<number | null> {
  const params = new URLSearchParams({ source_amount: amount })
  if (sendAsset.isNative()) params.set('source_asset_type', 'native')
  else {
    params.set('source_asset_type', sendAsset.getAssetType())
    params.set('source_asset_code', sendAsset.getCode())
    params.set('source_asset_issuer', sendAsset.getIssuer() ?? '')
  }
  params.set('destination_assets', destAsset.isNative() ? 'native' : `${destAsset.getCode()}:${destAsset.getIssuer() ?? ''}`)
  const response = await fetch(`${HORIZON_URL}/paths/strict-send?${params}`)
  if (!response.ok) return null
  const body = (await response.json()) as { _embedded: { records: { destination_amount: string }[] } }
  const best = body._embedded.records.map((record) => Number(record.destination_amount)).sort((a, b) => b - a)[0]
  return best ?? null
}

export async function sendToExchange(signer: Signer, amountUsdc: string, destination: string, memo: Memo, minXlm: string): Promise<string> {
  return submitClassic(
    signer,
    [
      Operation.pathPaymentStrictSend({
        sendAsset: blendUsdcAsset,
        sendAmount: amountUsdc,
        destination,
        destAsset: Asset.native(),
        destMin: minXlm,
        path: [],
      }),
    ],
    memo,
  )
}

export async function convertUsdt0ToUsdc(signer: Signer, amountUsdt0: string, minUsdc: string): Promise<string> {
  if (!usdt0Asset) throw new Error('USDT0 is not available on this network')
  return submitClassic(signer, [
    Operation.pathPaymentStrictSend({
      sendAsset: usdt0Asset,
      sendAmount: amountUsdt0,
      destination: signer.address,
      destAsset: blendUsdcAsset,
      destMin: minUsdc,
      path: [],
    }),
  ])
}

function withSlippage(amount: string, factor: number): string {
  return (Number(amount) * factor).toFixed(7)
}

export async function payAnchorWithBlendUsdc(signer: Signer, amountUsdc: string, treasury: string, memoId: string): Promise<string> {
  const operations = [
    Operation.pathPaymentStrictReceive({
      sendAsset: blendUsdcAsset,
      sendMax: withSlippage(amountUsdc, 1.03),
      destination: signer.address,
      destAsset: circleUsdcAsset,
      destAmount: amountUsdc,
      path: [],
    }),
    Operation.payment({ destination: treasury, asset: circleUsdcAsset, amount: amountUsdc }),
  ]
  return submitClassic(signer, operations, Memo.id(memoId))
}

export async function convertCircleToBlendUsdc(signer: Signer, receiveUsdc: string, sendMaxUsdc: string): Promise<string> {
  return submitClassic(signer, [
    Operation.pathPaymentStrictReceive({
      sendAsset: circleUsdcAsset,
      sendMax: sendMaxUsdc,
      destination: signer.address,
      destAsset: blendUsdcAsset,
      destAmount: receiveUsdc,
      path: [],
    }),
  ])
}

export interface ActivityEvent {
  kind: 'opened' | 'repaid' | 'payout'
  user: string
  ledger: number
  closedAt: number
  txHash: string
  a: bigint
  b: bigint
  anchorTxId?: string
}

function decodeEvent(event: rpc.Api.EventResponse): ActivityEvent | null {
  const topics = event.topic.map((t) => scValToNative(t))
  const kind = topics[1]
  if (kind !== 'opened' && kind !== 'repaid' && kind !== 'payout') return null
  const data = scValToNative(event.value) as Record<string, bigint | string>
  if (kind === 'payout') {
    return {
      kind,
      user: String(topics[2]),
      ledger: event.ledger,
      closedAt: Date.parse(event.ledgerClosedAt) || 0,
      txHash: event.txHash,
      a: BigInt(data.try_amount as bigint),
      b: 0n,
      anchorTxId: String(data.anchor_tx_id),
    }
  }
  const first = kind === 'opened' ? data.collateral_amount : data.repay_amount
  const second = kind === 'opened' ? data.borrow_amount : data.withdraw_collateral
  return {
    kind,
    user: String(topics[2]),
    ledger: event.ledger,
    closedAt: Date.parse(event.ledgerClosedAt) || 0,
    txHash: event.txHash,
    a: BigInt(first as bigint),
    b: BigInt(second as bigint),
  }
}

function cursorLedger(cursor: string | undefined): number | null {
  if (!cursor) return null
  const toid = Number(String(cursor).split('-')[0])
  return Number.isFinite(toid) ? Math.floor(toid / 4294967296) : null
}

async function collectEvents(startLedger: number): Promise<ActivityEvent[]> {
  const filters = [{ type: 'contract' as const, contractIds: [CREDIT_LINE_CONTRACT] }]
  const collected: ActivityEvent[] = []
  let cursor: string | undefined
  for (let page = 0; page < 12; page += 1) {
    const current = cursor
    const response = current
      ? await pool.run((s) => s.getEvents({ cursor: current, filters, limit: 200 }))
      : await pool.run((s) => s.getEvents({ startLedger, filters, limit: 200 }))
    for (const event of response.events) {
      const decoded = decodeEvent(event)
      if (decoded) collected.push(decoded)
    }
    const reached = cursorLedger(response.cursor)
    if (!response.cursor || reached === null || reached >= response.latestLedger) break
    cursor = response.cursor
  }
  return collected.reverse()
}

export async function getActivity(): Promise<ActivityEvent[]> {
  if (!CREDIT_LINE_CONTRACT) return []
  const latest = await pool.run((s) => s.getLatestLedger())
  for (const span of [17_280 * 4, 17_280, 3_000]) {
    try {
      return await collectEvents(Math.max(1, latest.sequence - span))
    } catch {
      continue
    }
  }
  return []
}
