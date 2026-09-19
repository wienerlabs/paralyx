import { readFileSync } from 'node:fs'
import { Account, BASE_FEE, Keypair, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://mainnet.sorobanrpc.com')
const passphrase = 'Public Global Stellar Network ; September 2015'
const wasm = readFileSync('../contracts/target/wasm32v1-none/release/credit_line.optimized.wasm')
const account = await server.getAccount('GDOZ44UXCLBBUTRQFOI6G5HQ5MGHG2LLEXALFKP4MTQBWEFHKPHDV52F')
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase }).addOperation(Operation.uploadContractWasm({ wasm })).setTimeout(60).build()
const sim = await server.simulateTransaction(tx)
if (!rpc.Api.isSimulationSuccess(sim)) { console.log('sim error', JSON.stringify(sim.error).slice(0, 300)); process.exit(1) }
console.log('wasm bytes', wasm.length, 'minResourceFee stroops', sim.minResourceFee, '=', (Number(sim.minResourceFee) / 1e7).toFixed(4), 'XLM')
const prepared = rpc.assembleTransaction(tx, sim).build()
console.log('total fee', (Number(prepared.fee) / 1e7).toFixed(4), 'XLM')
const latest = await server.getLatestLedger()
console.log('latest ledger', latest.sequence)
