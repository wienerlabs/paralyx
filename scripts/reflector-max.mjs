import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://mainnet.sorobanrpc.com')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
const other = (code) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(code)])
const FX = 'CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC'
async function read(id, method, args) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(String(sim.error).slice(0, 120))
  return scValToNative(sim.result.retval)
}
for (const n of []) {
  const out = await read(FX, 'prices', [other('TRY'), xdr.ScVal.scvU32(n)])
  console.log('records', n, out ? out.length : null)
  if (!out) break
}
const now = Math.floor(Date.now() / 1000)
for (const back of [3600, 6 * 3600, 24 * 3600, 48 * 3600]) {
  const ts = Math.floor((now - back) / 300) * 300
  try {
    const out = await read(FX, 'price', [other('TRY'), xdr.ScVal.scvU64(BigInt(ts))])
    console.log('price at -', back / 3600, 'h', out ? `${(1e14 / Number(out.price)).toFixed(2)} TRY/USD @${out.timestamp}` : null)
  } catch (e) { console.log('price at', back, 'throw', e.message) }
}
