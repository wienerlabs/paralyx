import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, Address } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-rpc.creit.tech')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x))
async function sim(id, method, args = []) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const s = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(s)) return 'ERR ' + String(s.error).slice(0, 160)
  return scValToNative(s.result.retval)
}
const BACKSTOP = 'CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7'
for (const [name, id] of [['FixedV2', 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'], ['YieldBloxV2', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS']]) {
  console.log(name, 'pool_data', j(await sim(BACKSTOP, 'pool_data', [new Address(id).toScVal()])))
}
for (const fn of ['get_reward_zone', 'reward_zone', 'get_rz']) {
  const out = await sim(BACKSTOP, fn)
  console.log(fn, typeof out === 'string' ? out.slice(0, 80) : j(out))
}
