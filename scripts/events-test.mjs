import { rpc, scValToNative } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-testnet.stellar.org')
const latest = await server.getLatestLedger()
const response = await server.getEvents({
  startLedger: latest.sequence - 17280,
  filters: [{ type: 'contract', contractIds: ['CDZ22YMZKGQZVHJKRJITRZREFKCTCURUKRC63G7ABIPO6SBHXTXL5Z4B'] }],
  limit: 50,
})
for (const event of response.events) {
  const topics = event.topic.map((t) => scValToNative(t))
  const data = scValToNative(event.value)
  console.log(event.ledger, topics.slice(0, 2).join('/'), String(topics[2]).slice(0, 6), JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}
