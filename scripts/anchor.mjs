import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'

const BASE = 'https://tr-mock-anchor.fly.dev'
const CIRCLE_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const USDC_ASSET = `stellar:USDC:${CIRCLE_ISSUER}`
const TRY_ASSET = 'iso4217:TRY'
const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const circleUsdc = new Asset('USDC', CIRCLE_ISSUER)

async function json(response) {
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

export async function auth(keypair) {
  const challenge = await json(await fetch(`${BASE}/auth?account=${keypair.publicKey()}`))
  const tx = TransactionBuilder.fromXDR(challenge.transaction, Networks.TESTNET)
  tx.sign(keypair)
  const result = await json(
    await fetch(`${BASE}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: tx.toXDR() }),
    }),
  )
  await fetch(`${BASE}/sep12/customer`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${result.token}` },
    body: JSON.stringify({ account: keypair.publicKey() }),
  })
  return result.token
}

export async function ensureTrust(keypair, asset) {
  const account = await horizon.loadAccount(keypair.publicKey())
  const has = account.balances.some((b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer())
  if (has) return null
  const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(120)
    .build()
  tx.sign(keypair)
  const result = await horizon.submitTransaction(tx)
  return result.hash
}

export async function pollTx(token, id, done) {
  for (let i = 0; i < 60; i += 1) {
    const result = await json(await fetch(`${BASE}/sep6/transaction?id=${id}`, { headers: { authorization: `Bearer ${token}` } }))
    const t = result.transaction
    process.stdout.write(`  status=${t.status}\n`)
    if (done(t.status) || t.status === 'error') return t
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('timeout')
}

export async function deposit(keypair, tryAmount) {
  const token = await auth(keypair)
  const trust = await ensureTrust(keypair, circleUsdc)
  if (trust) console.log('trustline tx', trust)
  const params = new URLSearchParams({
    source_asset: TRY_ASSET,
    destination_asset: 'USDC',
    amount: tryAmount.toFixed(2),
    account: keypair.publicKey(),
    type: 'bank_account',
    funding_method: 'bank_account',
  })
  const started = await json(await fetch(`${BASE}/sep6/deposit-exchange?${params}`, { headers: { authorization: `Bearer ${token}` } }))
  console.log('deposit started', JSON.stringify(started).slice(0, 600))
  const simulated = await json(
    await fetch(`${BASE}/sep6/tx/${started.id}/simulate-bank-transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: tryAmount.toFixed(2) }),
    }),
  )
  console.log('bank simulated', JSON.stringify(simulated).slice(0, 300))
  const final = await pollTx(token, started.id, (s) => s === 'completed')
  console.log('final', JSON.stringify(final).slice(0, 600))
  return final
}

export async function withdraw(keypair, usdcAmount) {
  const token = await auth(keypair)
  const params = new URLSearchParams({
    source_asset: 'USDC',
    destination_asset: TRY_ASSET,
    amount: usdcAmount.toFixed(7),
    type: 'bank_account',
    funding_method: 'bank_account',
  })
  const started = await json(await fetch(`${BASE}/sep6/withdraw-exchange?${params}`, { headers: { authorization: `Bearer ${token}` } }))
  console.log('withdraw started', JSON.stringify(started).slice(0, 600))
  return { token, started }
}

const [command, secret, amount] = process.argv[1].endsWith("anchor.mjs") ? process.argv.slice(2) : []
if (command) {
  const keypair = Keypair.fromSecret(secret)
  if (command === 'deposit') await deposit(keypair, Number(amount))
  if (command === 'withdraw') await withdraw(keypair, Number(amount))
  if (command === 'auth') console.log(await auth(keypair))
}
