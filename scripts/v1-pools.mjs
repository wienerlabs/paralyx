import { Account, Address, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-rpc.creit.tech')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x))
async function sim(id, method, args = []) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const s = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(s)) return 'ERR ' + String(s.error).replace(/\s+/g, ' ').slice(0, 120)
  return scValToNative(s.result.retval)
}
const names = { CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA: 'XLM', CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: 'USDC' }
for (const [label, pool] of [['Fixed v1', 'CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP'], ['YieldBlox v1', 'CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB']]) {
  const cfg = await sim(pool, 'get_config')
  const would = await sim(pool, 'update_status')
  const reserves = await sim(pool, 'get_reserve_list')
  console.log(label, 'config', j(cfg), '| update_status ->', j(would))
  if (Array.isArray(reserves)) {
    console.log('  reserves', reserves.map((r) => names[r] ?? r.slice(0, 6)).join(', '))
    for (const asset of reserves) {
      if (!names[asset]) continue
      const r = await sim(pool, 'get_reserve', [new Address(asset).toScVal()])
      if (typeof r === 'string') { console.log('  ', names[asset], r); continue }
      const supplied = Number((BigInt(r.data.b_supply) * BigInt(r.data.b_rate)) / 1000000000n) / 1e7
      const borrowed = Number((BigInt(r.data.d_supply) * BigInt(r.data.d_rate)) / 1000000000n) / 1e7
      console.log(`   ${names[asset]}: c_factor ${r.config.c_factor / 1e7} l_factor ${r.config.l_factor / 1e7} max_util ${r.config.max_util / 1e7} supplied ${supplied.toFixed(0)} borrowed ${borrowed.toFixed(0)} util ${(borrowed / Math.max(supplied, 1) * 100).toFixed(1)}%`)
    }
  } else console.log('  reserves', reserves)
}
