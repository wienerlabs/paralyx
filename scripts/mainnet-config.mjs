import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, Address, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-rpc.creit.tech')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x))
async function read(id, method, args) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(String(sim.error).slice(0, 200))
  return scValToNative(sim.result.retval)
}
const POOL = 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'
console.log('FixedV2 config', j(await read(POOL, 'get_config', [])))
const usdc = await read(POOL, 'get_reserve', [new Address('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75').toScVal()])
console.log('USDC reserve config', j(usdc.config))
const xlm = await read(POOL, 'get_reserve', [new Address('CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA').toScVal()])
console.log('XLM reserve config', j(xlm.config))
console.log('paralyx mainnet line count', j(await read('CDCYHJPSXA6YT5HWXOWN5R6NL2BMD5PCIXGPBVOU2C4MJHFVV6LC7ITC', 'get_line_count', [])))
