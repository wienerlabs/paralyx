import { rpc, scValToNative } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-testnet.stellar.org')
const latest = await server.getLatestLedger()
console.log('latest', latest.sequence)
for (const span of [3000, 800, 300]) {
  try {
    const response = await server.getEvents({
      startLedger: latest.sequence - span,
      filters: [{ type: 'contract', contractIds: ['CDZ22YMZKGQZVHJKRJITRZREFKCTCURUKRC63G7ABIPO6SBHXTXL5Z4B'] }],
      limit: 50,
    })
    console.log('span', span, 'events', response.events.length, 'latestLedger', response.latestLedger)
    for (const event of response.events.slice(0, 6)) {
      const topics = event.topic.map((t) => scValToNative(t))
      const data = scValToNative(event.value)
      console.log(' ', event.ledger, topics.slice(0, 2).join('/'), String(topics[2]).slice(0, 6), JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v)))
    }
    if (response.events.length > 0) break
  } catch (error) {
    console.log('span', span, 'error', error?.message ?? error)
  }
}
