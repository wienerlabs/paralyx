import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-rpc.creit.tech')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
async function sim(id, method, args = []) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const s = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(s)) return 'ERR ' + String(s.error).slice(0, 160)
  return scValToNative(s.result.retval)
}
for (const [name, id] of [['FixedV2', 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'], ['YieldBloxV2', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS']]) {
  const cfg = await sim(id, 'get_config')
  const would = await sim(id, 'update_status')
  console.log(name, 'stored status', cfg.status, '| update_status would return', would)
}
