import { rpc } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-testnet.stellar.org')
const latest = (await server.getLatestLedger()).sequence
const filters = [{ type: 'contract', contractIds: ['CDZ22YMZKGQZVHJKRJITRZREFKCTCURUKRC63G7ABIPO6SBHXTXL5Z4B'] }]
let cursor
let total = 0
for (let i = 0; i < 20; i += 1) {
  const params = cursor ? { cursor, filters, limit: 200 } : { startLedger: latest - 40000, filters, limit: 200 }
  const response = await server.getEvents(params)
  const cursorLedger = response.cursor ? Math.floor(Number(String(response.cursor).split('-')[0]) / 4294967296) : null
  console.log('page', i, 'events', response.events.length, 'cursor', response.cursor, 'cursorLedger', cursorLedger, 'latest', response.latestLedger)
  total += response.events.length
  if (!response.cursor || (cursorLedger !== null && cursorLedger >= response.latestLedger - 1)) break
  cursor = response.cursor
}
console.log('total', total)
