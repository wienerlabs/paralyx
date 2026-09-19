import { Account, Address, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://mainnet.sorobanrpc.com')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
async function read(id, method, args) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(String(sim.error).slice(0, 200))
  return scValToNative(sim.result.retval)
}
const names = { CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA: 'XLM', CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: 'USDC', CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF: 'USDT0' }
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x))
for (const [label, pool] of [['FixedV2', 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'], ['YieldBloxV2', 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS']]) {
  try {
    const config = await read(pool, 'get_config', [])
    const reserves = await read(pool, 'get_reserve_list', [])
    console.log(label, 'status', config.status, 'oracle', config.oracle, 'bstop', config.bstop_rate, 'max_positions', config.max_positions)
    console.log('  reserves', reserves.map((r) => names[r] ?? r.slice(0, 8)).join(', '))
    for (const asset of reserves) {
      if (!names[asset]) continue
      const r = await read(pool, 'get_reserve', [new Address(asset).toScVal()])
      const supplied = Number((BigInt(r.data.b_supply) * BigInt(r.data.b_rate)) / 1000000000000n) / 1e7
      const borrowed = Number((BigInt(r.data.d_supply) * BigInt(r.data.d_rate)) / 1000000000000n) / 1e7
      let price = null
      try { const p = await read(config.oracle, 'lastprice', [xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Stellar'), new Address(asset).toScVal()])]); price = p ? Number(p.price) : null } catch (e) { price = 'err ' + e.message.slice(0, 60) }
      console.log(`  ${names[asset]}: c_factor ${r.config.c_factor / 1e7} l_factor ${r.config.l_factor / 1e7} enabled ${r.config.enabled} supplied ${supplied.toFixed(0)} borrowed ${borrowed.toFixed(0)} price ${price}`)
    }
  } catch (e) { console.log(label, 'error', e.message) }
}
try { const dec = await read('CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB', 'get_config', []); console.log('YieldBlox v1 status', dec.status) } catch {}
