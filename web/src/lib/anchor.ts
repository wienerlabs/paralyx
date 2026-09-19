import { ANCHOR_BASE, ANCHOR_TRY_ASSET, ANCHOR_USDC_ASSET } from '../config'
import type { Signer } from './chain'

const tokens = new Map<string, string>()

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`anchor ${response.status}: ${text.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

export async function authenticate(signer: Signer): Promise<string> {
  const cached = tokens.get(signer.address)
  if (cached) return cached
  const challenge = await json<{ transaction: string }>(
    await fetch(`${ANCHOR_BASE}/auth?account=${encodeURIComponent(signer.address)}`),
  )
  const signedXdr = await signer.sign(challenge.transaction)
  const result = await json<{ token: string }>(
    await fetch(`${ANCHOR_BASE}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: signedXdr }),
    }),
  )
  tokens.set(signer.address, result.token)
  await fetch(`${ANCHOR_BASE}/sep12/customer`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${result.token}` },
    body: JSON.stringify({ account: signer.address }),
  }).catch(() => undefined)
  return result.token
}

export function forgetToken(address: string): void {
  tokens.delete(address)
}

export interface Quote {
  price: number
  buyAmount: number
  sellAmount: number
  feeTotal: number
}

export async function quoteUsdcToTry(usdcAmount: number): Promise<Quote> {
  const params = new URLSearchParams({
    sell_asset: ANCHOR_USDC_ASSET,
    buy_asset: ANCHOR_TRY_ASSET,
    sell_amount: usdcAmount.toFixed(2),
    context: 'sep6',
  })
  const result = await json<{ price: string; buy_amount: string; sell_amount: string; fee: { total: string } }>(
    await fetch(`${ANCHOR_BASE}/sep38/price?${params}`),
  )
  return {
    price: Number(result.price),
    buyAmount: Number(result.buy_amount),
    sellAmount: Number(result.sell_amount),
    feeTotal: Number(result.fee?.total ?? 0),
  }
}

export async function quoteTryToUsdc(tryAmount: number): Promise<Quote> {
  const params = new URLSearchParams({
    sell_asset: ANCHOR_TRY_ASSET,
    buy_asset: ANCHOR_USDC_ASSET,
    sell_amount: tryAmount.toFixed(2),
    context: 'sep6',
  })
  const result = await json<{ price: string; buy_amount: string; sell_amount: string; fee: { total: string } }>(
    await fetch(`${ANCHOR_BASE}/sep38/price?${params}`),
  )
  return {
    price: Number(result.price),
    buyAmount: Number(result.buy_amount),
    sellAmount: Number(result.sell_amount),
    feeTotal: Number(result.fee?.total ?? 0),
  }
}

export interface WithdrawInstruction {
  id: string
  accountId: string
  memo: string
  memoType: string
}

export async function startWithdraw(token: string, usdcAmount: number): Promise<WithdrawInstruction> {
  const params = new URLSearchParams({
    source_asset: 'USDC',
    destination_asset: ANCHOR_TRY_ASSET,
    amount: usdcAmount.toFixed(7),
    type: 'bank_account',
    funding_method: 'bank_account',
  })
  const result = await json<{ id: string; account_id: string; memo: string; memo_type: string }>(
    await fetch(`${ANCHOR_BASE}/sep6/withdraw-exchange?${params}`, { headers: { authorization: `Bearer ${token}` } }),
  )
  return { id: result.id, accountId: result.account_id, memo: String(result.memo), memoType: result.memo_type }
}

export interface DepositInstruction {
  id: string
  how: string
  iban?: string
  reference?: string
  moreInfoUrl?: string
}

export async function startDeposit(token: string, account: string, tryAmount: number): Promise<DepositInstruction> {
  const params = new URLSearchParams({
    source_asset: ANCHOR_TRY_ASSET,
    destination_asset: 'USDC',
    amount: tryAmount.toFixed(2),
    account,
    type: 'bank_account',
    funding_method: 'bank_account',
  })
  const result = await json<{
    id: string
    how?: string
    more_info_url?: string
    instructions?: Record<string, { value: string }>
  }>(await fetch(`${ANCHOR_BASE}/sep6/deposit-exchange?${params}`, { headers: { authorization: `Bearer ${token}` } }))
  return {
    id: result.id,
    how: result.how ?? '',
    iban: result.instructions?.bank_account_number?.value,
    reference: result.instructions?.external_transfer_memo?.value,
    moreInfoUrl: result.more_info_url,
  }
}

export async function simulateBankTransfer(token: string, id: string, tryAmount: number): Promise<void> {
  await json(
    await fetch(`${ANCHOR_BASE}/sep6/tx/${encodeURIComponent(id)}/simulate-bank-transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: tryAmount.toFixed(2) }),
    }),
  )
}

export interface AnchorTransaction {
  id: string
  status: string
  amountIn?: string
  amountOut?: string
  amountFee?: string
  externalTransactionId?: string
  stellarTransactionId?: string
  moreInfoUrl?: string
}

export async function getTransaction(token: string, id: string): Promise<AnchorTransaction> {
  const result = await json<{ transaction: Record<string, string> }>(
    await fetch(`${ANCHOR_BASE}/sep6/transaction?id=${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  )
  const t = result.transaction
  return {
    id: t.id,
    status: t.status,
    amountIn: t.amount_in,
    amountOut: t.amount_out,
    amountFee: t.amount_fee,
    externalTransactionId: t.external_transaction_id,
    stellarTransactionId: t.stellar_transaction_id,
    moreInfoUrl: t.more_info_url,
  }
}

export async function waitForStatus(
  token: string,
  id: string,
  done: (status: string) => boolean,
  onUpdate?: (transaction: AnchorTransaction) => void,
): Promise<AnchorTransaction> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const transaction = await getTransaction(token, id)
    onUpdate?.(transaction)
    if (done(transaction.status) || transaction.status === 'error') return transaction
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('anchor transaction timed out')
}
