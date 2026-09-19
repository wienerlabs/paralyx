import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://mainnet.sorobanrpc.com')
const passphrase = 'Public Global Stellar Network ; September 2015'
const source = new Account(Keypair.random().publicKey(), '0')
const other = (code) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(code)])
for (const [id, code] of [['CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC', 'TRY'], ['CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN', 'XLM']]) {
  for (const records of [288, 96, 24]) {
    try {
      const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(new Contract(id).call('prices', other(code), xdr.ScVal.scvU32(records))).setTimeout(30).build()
      const sim = await server.simulateTransaction(tx)
      if (!rpc.Api.isSimulationSuccess(sim)) { console.log(code, records, 'sim error', String(sim.error).slice(0, 160)); continue }
      const out = scValToNative(sim.result.retval)
      console.log(code, records, 'ok', out ? out.length : out)
    } catch (e) { console.log(code, records, 'throw', String(e.message).slice(0, 160)) }
  }
}
