import { Account, BASE_FEE, Contract, Keypair, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class RpcPool {
  readonly servers: rpc.Server[]
  private readonly passphrase: string
  private readonly concurrency: number
  private active = 0
  private waiting: (() => void)[] = []
  private readonly source = new Account(Keypair.random().publicKey(), '0')

  constructor(urls: string[], passphrase: string, concurrency = 4) {
    this.servers = urls.map((url) => new rpc.Server(url))
    this.passphrase = passphrase
    this.concurrency = concurrency
  }

  get primary(): rpc.Server {
    return this.servers[0]
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active += 1
        resolve()
      })
    })
  }

  private release(): void {
    this.active -= 1
    const next = this.waiting.shift()
    if (next) next()
  }

  async run<T>(fn: (server: rpc.Server) => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      let lastError: unknown = new Error('rpc unavailable')
      const attempts = this.servers.length * 3
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const server = this.servers[attempt % this.servers.length]
        try {
          return await fn(server)
        } catch (error) {
          lastError = error
          await sleep(250 * (attempt + 1))
        }
      }
      throw lastError
    } finally {
      this.release()
    }
  }

  simulate(contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
    if (!contractId) return Promise.reject(new Error('contract not deployed on this network'))
    return this.run(async (server) => {
      const tx = new TransactionBuilder(this.source, { fee: BASE_FEE, networkPassphrase: this.passphrase })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(30)
        .build()
      const sim = await server.simulateTransaction(tx)
      if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
        throw new Error(`simulation failed for ${method}: ${'error' in sim ? String(sim.error).slice(0, 120) : 'unknown'}`)
      }
      return scValToNative(sim.result.retval)
    })
  }
}
