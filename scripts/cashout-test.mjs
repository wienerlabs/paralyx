import { Asset, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'
import { pollTx, withdraw } from './anchor.mjs'

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const blendUsdc = new Asset('USDC', 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56')
const circleUsdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')

const [secret, amountArg] = process.argv.slice(2)
const keypair = Keypair.fromSecret(secret)
const amount = Number(amountArg).toFixed(7)
const { token, started } = await withdraw(keypair, Number(amountArg))
const account = await horizon.loadAccount(keypair.publicKey())
const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.pathPaymentStrictSend({ sendAsset: blendUsdc, sendAmount: amount, destination: keypair.publicKey(), destAsset: circleUsdc, destMin: amount, path: [] }))
  .addOperation(Operation.payment({ destination: started.account_id, asset: circleUsdc, amount }))
  .addMemo(Memo.id(String(started.memo)))
  .setTimeout(120)
  .build()
tx.sign(keypair)
const result = await horizon.submitTransaction(tx)
console.log('paid anchor', result.hash)
const final = await pollTx(token, started.id, (s) => s === 'completed')
console.log('final', JSON.stringify({ status: final.status, amount_in: final.amount_in, amount_out: final.amount_out, ext: final.external_transaction_id }))
