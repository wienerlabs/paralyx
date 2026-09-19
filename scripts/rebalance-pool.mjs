import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const blendUsdc = new Asset('USDC', 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56')
const circleUsdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')

const [secret, amountArg] = process.argv.slice(2)
const keypair = Keypair.fromSecret(secret)
const account = await horizon.loadAccount(keypair.publicKey())
const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.pathPaymentStrictSend({ sendAsset: blendUsdc, sendAmount: Number(amountArg).toFixed(7), destination: keypair.publicKey(), destAsset: circleUsdc, destMin: '1', path: [] }))
  .setTimeout(120)
  .build()
tx.sign(keypair)
try {
  const result = await horizon.submitTransaction(tx)
  console.log('swapped', result.hash)
} catch (error) {
  console.error('swap failed', JSON.stringify(error?.response?.data?.extras?.result_codes ?? error?.message))
  process.exit(1)
}
const pools = await horizon.liquidityPools().forAssets(blendUsdc, circleUsdc).call()
for (const pool of pools.records) console.log('pool', pool.reserves.map((r) => `${r.asset.slice(0, 12)} ${r.amount}`))
const after = await horizon.loadAccount(keypair.publicKey())
console.log('balances', after.balances.filter((b) => b.asset_code).map((b) => `${b.asset_code}:${b.asset_issuer.slice(0, 6)} ${b.balance}`))
