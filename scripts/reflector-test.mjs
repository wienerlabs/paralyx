import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://mainnet.sorobanrpc.com')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
async function read(contractId, method, args) {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(contractId).call(method, ...args)).setTimeout(30).build()
  const sim = await server.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(JSON.stringify(sim.error ?? sim).slice(0, 300))
  return scValToNative(sim.result.retval)
}
const other = (code) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(code)])
const FX = 'CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC'
const CEX = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN'
for (const [name, id, code] of [['fx TRY', FX, 'TRY'], ['cex XLM', CEX, 'XLM']]) {
  try {
    const decimals = await read(id, 'decimals', [])
    const resolution = await read(id, 'resolution', [])
    const last = await read(id, 'lastprice', [other(code)])
    const prices = await read(id, 'prices', [other(code), xdr.ScVal.scvU32(6)])
    console.log(name, 'decimals', decimals, 'resolution', resolution, 'last', JSON.stringify(last, (k, v) => typeof v === 'bigint' ? v.toString() : v))
    console.log('  prices', JSON.stringify(prices, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 400))
  } catch (error) { console.log(name, 'error', error.message) }
}
