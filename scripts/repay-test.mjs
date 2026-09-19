import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'
import { deposit } from './anchor.mjs'

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const blendUsdc = new Asset('USDC', 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56')
const circleUsdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
const [secret, tryArg] = process.argv.slice(2)
const keypair = Keypair.fromSecret(secret)
const final = await deposit(keypair, Number(tryArg))
const received = Number(final.amount_out)
const want = (received * 0.97).toFixed(7)
const account = await horizon.loadAccount(keypair.publicKey())
const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.pathPaymentStrictReceive({ sendAsset: circleUsdc, sendMax: received.toFixed(7), destination: keypair.publicKey(), destAsset: blendUsdc, destAmount: want, path: [] }))
  .setTimeout(120)
  .build()
tx.sign(keypair)
try {
  const result = await horizon.submitTransaction(tx)
  console.log('converted', want, 'blend usdc', result.hash)
} catch (error) {
  console.error('convert failed', JSON.stringify(error?.response?.data?.extras?.result_codes ?? error?.message))
  process.exit(1)
}
