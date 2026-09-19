import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const blendUsdc = new Asset('USDC', 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56')
const circleUsdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')

const [secret, circleAmount, blendAmount] = process.argv.slice(2)
const keypair = Keypair.fromSecret(secret)
const account = await horizon.loadAccount(keypair.publicKey())
const balance = (asset) => account.balances.find((b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer())?.balance ?? '0'
console.log('inventory', { circle: balance(circleUsdc), blend: balance(blendUsdc) })

const builder = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
if (Number(circleAmount) > 0) {
  builder.addOperation(Operation.manageSellOffer({ selling: circleUsdc, buying: blendUsdc, amount: Number(circleAmount).toFixed(7), price: '1', offerId: '0' }))
}
if (Number(blendAmount) > 0) {
  builder.addOperation(Operation.manageSellOffer({ selling: blendUsdc, buying: circleUsdc, amount: Number(blendAmount).toFixed(7), price: '1', offerId: '0' }))
}
const tx = builder.setTimeout(120).build()
tx.sign(keypair)
const result = await horizon.submitTransaction(tx)
console.log('offers posted', result.hash)
const offers = await horizon.offers().forAccount(keypair.publicKey()).call()
console.log(offers.records.map((o) => `${o.amount} ${o.selling.asset_code}:${(o.selling.asset_issuer || '').slice(0, 6)} -> ${o.buying.asset_code}:${(o.buying.asset_issuer || '').slice(0, 6)} @ ${o.price}`))
