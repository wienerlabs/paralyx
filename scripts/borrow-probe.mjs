import { Account, Address, BASE_FEE, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-rpc.creit.tech')
const passphrase = 'Public Global Stellar Network ; September 2015'
const FIXED = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'
const latest = (await server.getLatestLedger()).sequence
const events = await server.getEvents({ startLedger: latest - 6000, filters: [{ type: 'contract', contractIds: [FIXED] }], limit: 200 })
const users = new Map()
for (const ev of events.events) {
  const topics = ev.topic.map((t) => { try { return scValToNative(t) } catch { return '?' } })
  const kind = String(topics[0])
  if (['borrow', 'supply_collateral', 'repay', 'withdraw_collateral'].includes(kind)) {
    const user = String(topics[topics.length - 1])
    if (user.startsWith('G')) users.set(user, kind)
  }
}
console.log('recent events', events.events.length, 'candidate users', users.size, [...users.entries()].slice(0, 4))
const candidates = [...users.keys()].slice(0, 5)
for (const user of candidates) {
  const account = await server.getAccount(user).catch(() => null)
  if (!account) continue
  const req = xdr.ScVal.scvVec([xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('address'), val: new Address(USDC).toScVal() }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('amount'), val: nativeToScVal(1000n, { type: 'i128' }) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('request_type'), val: nativeToScVal(4, { type: 'u32' }) }),
  ])])
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(new Contract(FIXED).call('submit', new Address(user).toScVal(), new Address(user).toScVal(), new Address(user).toScVal(), req))
    .setTimeout(30).build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationSuccess(sim)) { console.log(user.slice(0, 6), 'BORROW 0.0001 USDC simulation: SUCCESS (borrowing allowed)'); break }
  console.log(user.slice(0, 6), 'BORROW simulation error:', String(sim.error).replace(/\s+/g, ' ').slice(0, 220))
  const req2 = xdr.ScVal.scvVec([xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('address'), val: new Address('CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA').toScVal() }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('amount'), val: nativeToScVal(10000000n, { type: 'i128' }) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('request_type'), val: nativeToScVal(2, { type: 'u32' }) }),
  ])])
  const tx2 = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(new Contract(FIXED).call('submit', new Address(user).toScVal(), new Address(user).toScVal(), new Address(user).toScVal(), req2))
    .setTimeout(30).build()
  const sim2 = await server.simulateTransaction(tx2)
  console.log(user.slice(0, 6), 'SUPPLY_COLLATERAL 1 XLM simulation:', rpc.Api.isSimulationSuccess(sim2) ? 'SUCCESS' : String(sim2.error).replace(/\s+/g, ' ').slice(0, 160))
  break
}
