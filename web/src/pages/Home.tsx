import { useCallback, useEffect, useMemo, useState } from 'react'
import { ANCHOR_HOME_DOMAIN, ANCHOR_MAX_TRY, ANCHOR_MAX_USDC, BLEND_POOL, CREDIT_LINE_CONTRACT, EXPLORER_CONTRACT, EXPLORER_TX } from '../config'
import {
  authenticate,
  quoteTryToUsdc,
  quoteUsdcToTry,
  simulateBankTransfer,
  startDeposit,
  startWithdraw,
  waitForStatus,
} from '../lib/anchor'
import {
  convertCircleToBlendUsdc,
  ensureTrustlines,
  formatAmount,
  fromStroops,
  fundWithFriendbot,
  getActivity,
  getHealth,
  getLine,
  getReserves,
  getWalletState,
  openLine,
  payAnchorWithBlendUsdc,
  previewBorrowable,
  recordPayout,
  repayLine,
  toStroops,
  type ActivityEvent,
  type Health,
  type Line,
  type ReserveView,
  type Signer,
  type WalletState,
} from '../lib/chain'
import { useT, type DictKey } from '../lib/i18n'
import { useWallet } from '../lib/wallet'
import { Steps, type Step } from '../components/Steps'

interface Shared {
  signer: Signer | null
  wallet: WalletState | null
  line: Line | null
  health: Health | null
  reserves: { xlm: ReserveView; usdc: ReserveView } | null
  rate: number | null
  refresh: () => Promise<void>
}

type Mark = (index: number, state: Step['state'], detail?: string) => void

function useFlow(labels: DictKey[]) {
  const { t } = useT()
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = () => {
    setError(null)
    setBusy(true)
    setSteps(labels.map((label) => ({ label: t(label), state: 'pending' })))
  }
  const mark: Mark = (index, state, detail) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, state, detail: detail ?? step.detail } : step)))
  const run = async (fn: (mark: Mark) => Promise<void>) => {
    start()
    try {
      await fn(mark)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message)
      setSteps((current) => {
        const active = current.findIndex((step) => step.state === 'active')
        return current.map((step, i) => (i === active ? { ...step, state: 'failed' } : step))
      })
    } finally {
      setBusy(false)
    }
  }
  return { steps, busy, error, run }
}

function txLink(hash: string) {
  return `${EXPLORER_TX}${hash}`
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-xs text-mute">{label}</div>
      <div className="mt-1 text-lg text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-mute">{hint}</div> : null}
    </div>
  )
}

function LineCard({ line, health, rate, wallet }: Shared) {
  const { t } = useT()
  const limitTry = health && rate ? health.borrowableUsdc * rate : null
  return (
    <div className="card">
      <div className="text-xs text-mute">{t('limit')}</div>
      <div className="mt-2 text-5xl tracking-tight text-ink">
        {limitTry === null ? '·' : `₺${formatAmount(limitTry, 0)}`}
      </div>
      <div className="mt-1 text-sm text-mute">
        {health ? `${formatAmount(health.borrowableUsdc)} USDC` : ''}
        {rate ? ` · 1 USDC ≈ ₺${formatAmount(rate)}` : ''}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric
          label={t('collateral')}
          value={health ? `${formatAmount(health.collateralXlm)} XLM` : '·'}
          hint={health ? `$${formatAmount(health.collateralXlm * health.xlmPrice)}` : undefined}
        />
        <Metric
          label={t('debt')}
          value={health ? `${formatAmount(health.debtUsdc)} USDC` : '·'}
          hint={health && rate ? `₺${formatAmount(health.debtUsdc * rate)}` : undefined}
        />
        <Metric
          label={t('health')}
          value={health ? (health.healthFactor === null ? t('noDebt') : formatAmount(health.healthFactor)) : '·'}
        />
        <Metric
          label={t('balance')}
          value={wallet ? `${formatAmount(wallet.xlm)} XLM` : '·'}
          hint={wallet && wallet.blendUsdc !== null ? `${formatAmount(wallet.blendUsdc)} USDC` : undefined}
        />
      </div>
      {line ? (
        <div className="mt-6 space-y-1 text-sm text-mute">
          <div className="text-xs text-mute">{t('yourLine')}</div>
          <div className="flex justify-between">
            <span>{t('totalBorrowed')}</span>
            <span className="text-ink">{fromStroops(line.borrowed)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span>{t('totalRepaid')}</span>
            <span className="text-ink">{fromStroops(line.repaid)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span>{t('payouts')}</span>
            <span className="text-ink">
              {line.payouts} · ₺{formatAmount(Number(line.payout_try) / 100)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WalletCard({ signer, wallet, refresh }: Shared) {
  const { t } = useT()
  const flow = useFlow(['sending', 'done'])
  if (!signer || !wallet) return null
  const needsXlm = !wallet.exists || wallet.xlm < 20
  const needsTrust = wallet.blendUsdc === null || wallet.circleUsdc === null
  if (!needsXlm && !needsTrust) return null
  const fund = () =>
    flow.run(async (mark) => {
      mark(0, 'active')
      await fundWithFriendbot(signer.address)
      mark(0, 'done')
      mark(1, 'done')
      await refresh()
    })
  const trust = () =>
    flow.run(async (mark) => {
      mark(0, 'active')
      const hash = await ensureTrustlines(signer, wallet)
      mark(0, 'done', hash ? txLink(hash) : undefined)
      mark(1, 'done')
      await refresh()
    })
  return (
    <div className="card">
      <h3 className="text-lg text-ink">{t('walletTitle')}</h3>
      <p className="mt-1 text-sm text-mute">{t('walletBody')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {needsXlm ? (
          <button type="button" className="btn" disabled={flow.busy} onClick={() => void fund()}>
            {t('fund')}
          </button>
        ) : null}
        {needsTrust && wallet.exists ? (
          <button type="button" className="btn" disabled={flow.busy} onClick={() => void trust()}>
            {t('trust')}
          </button>
        ) : null}
      </div>
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function OpenCard({ signer, wallet, health, reserves, rate, refresh }: Shared) {
  const { t } = useT()
  const [collateral, setCollateral] = useState('100')
  const [borrow, setBorrow] = useState('10')
  const flow = useFlow(['signing', 'sending', 'done'])
  const maxBorrow = useMemo(() => {
    if (!health || !reserves) return null
    const xlm = Number(collateral.replace(',', '.')) || 0
    return previewBorrowable(xlm, reserves.xlm, reserves.usdc, health)
  }, [collateral, health, reserves])
  const ready = Boolean(signer && wallet?.exists && wallet.blendUsdc !== null)
  const borrowNumber = Number(borrow.replace(',', '.')) || 0
  const collateralNumber = Number(collateral.replace(',', '.')) || 0
  const valid = ready && collateralNumber >= 0 && borrowNumber >= 0 && collateralNumber + borrowNumber > 0 && (maxBorrow === null || borrowNumber <= maxBorrow + 1e-9)
  const submit = () =>
    flow.run(async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      mark(0, 'active')
      const hash = await openLine(signer, toStroops(collateral), toStroops(borrow))
      mark(0, 'done')
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      await refresh()
    })
  return (
    <div className="card">
      <h3 className="text-lg text-ink">{t('openTitle')}</h3>
      <p className="mt-1 text-sm text-mute">{t('openBody')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('collateralXlm')}</label>
          <input className="input" inputMode="decimal" value={collateral} onChange={(e) => setCollateral(e.target.value)} />
          {wallet ? <div className="mt-1 text-xs text-mute">{t('balance')}: {formatAmount(wallet.xlm)} XLM</div> : null}
        </div>
        <div>
          <label className="label">{t('borrowUsdc')}</label>
          <input className="input" inputMode="decimal" value={borrow} onChange={(e) => setBorrow(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {maxBorrow !== null ? `${t('maxBorrow')} ${formatAmount(maxBorrow)} USDC` : ''}
            {rate && borrowNumber > 0 ? ` · ${t('equalsTry')} ₺${formatAmount(borrowNumber * rate)}` : ''}
          </div>
        </div>
      </div>
      <button type="button" className="btn mt-4" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('open')}
      </button>
      {!ready && signer ? <p className="mt-2 text-xs text-mute">{t('walletBody')}</p> : null}
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function CashOutCard({ signer, wallet, line, health, rate, refresh }: Shared) {
  const { t } = useT()
  const [amount, setAmount] = useState('10')
  const [result, setResult] = useState<{ reference?: string; tryPaid: number } | null>(null)
  const flow = useFlow(['anchorAuth', 'anchorQuote', 'anchorWithdraw', 'paying', 'anchorWait', 'recording', 'done'])
  const amountNumber = Number(amount.replace(',', '.')) || 0
  const available = wallet?.blendUsdc ?? 0
  const valid = Boolean(signer && line) && amountNumber >= 0.5 && amountNumber <= Math.min(available, ANCHOR_MAX_USDC)
  const submit = () =>
    flow.run(async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (!line) throw new Error(t('needLine'))
      setResult(null)
      mark(0, 'active')
      const token = await authenticate(signer)
      mark(0, 'done')
      mark(1, 'active')
      const quote = await quoteUsdcToTry(amountNumber)
      mark(1, 'done', `₺${formatAmount(quote.buyAmount)}`)
      mark(2, 'active')
      const instruction = await startWithdraw(token, amountNumber)
      mark(2, 'done', `${instruction.id} · memo ${instruction.memo}`)
      mark(3, 'active')
      const hash = await payAnchorWithBlendUsdc(signer, amountNumber.toFixed(7), instruction.accountId, instruction.memo)
      mark(3, 'done', txLink(hash))
      mark(4, 'active')
      const settled = await waitForStatus(token, instruction.id, (status) => status === 'completed', (tx) => mark(4, 'active', tx.status))
      if (settled.status !== 'completed') throw new Error(`anchor status ${settled.status}`)
      const tryPaid = Number(settled.amountOut ?? quote.buyAmount)
      mark(4, 'done', `₺${formatAmount(tryPaid)}${settled.externalTransactionId ? ` · ${settled.externalTransactionId}` : ''}`)
      mark(5, 'active')
      const recordHash = await recordPayout(signer, instruction.id, BigInt(Math.round(tryPaid * 100)))
      mark(5, 'done', txLink(recordHash))
      mark(6, 'done')
      setResult({ reference: settled.externalTransactionId, tryPaid })
      await refresh()
    })
  return (
    <div className="card">
      <h3 className="text-lg text-ink">{t('cashTitle')}</h3>
      <p className="mt-1 text-sm text-mute">{t('cashBody')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('amountUsdc')}</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {t('balance')}: {formatAmount(available)} USDC{health ? ` · ${t('debt')}: ${formatAmount(health.debtUsdc)} USDC` : ''}
          </div>
        </div>
        <div>
          <label className="label">{t('youGet')}</label>
          <div className="input bg-soft">{rate ? `₺${formatAmount(amountNumber * rate)}` : '·'}</div>
          <div className="mt-1 text-xs text-mute">{t('quoteHint')}</div>
        </div>
      </div>
      <button type="button" className="btn mt-4" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('cashOut')}
      </button>
      {!line && signer ? <p className="mt-2 text-xs text-mute">{t('needLine')}</p> : null}
      <Steps steps={flow.steps} />
      {result ? (
        <div className="mt-4 rounded-2xl bg-soft p-4 text-sm">
          <div className="text-ink">₺{formatAmount(result.tryPaid)}</div>
          {result.reference ? (
            <div className="text-xs text-mute">
              {t('reference')}: {result.reference}
            </div>
          ) : null}
        </div>
      ) : null}
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
      <p className="mt-3 text-xs text-mute">{t('seamHint')}</p>
    </div>
  )
}

function RepayCard({ signer, line, health, rate, refresh }: Shared) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [withdrawAll, setWithdrawAll] = useState(true)
  const [instruction, setInstruction] = useState<{ iban?: string; reference?: string } | null>(null)
  const flow = useFlow(['anchorAuth', 'anchorDeposit', 'anchorBank', 'anchorWait', 'converting', 'sending', 'done'])
  useEffect(() => {
    if (health && rate && amount === '' && health.debtUsdc > 0) {
      setAmount(Math.min(ANCHOR_MAX_TRY, Math.ceil(health.debtUsdc * 1.01 * rate)).toString())
    }
  }, [health, rate, amount])
  const amountNumber = Number(amount.replace(',', '.')) || 0
  const usdcEstimate = rate ? amountNumber / rate : 0
  const valid = Boolean(signer && line && health && health.debtUsdc > 0) && amountNumber >= 50 && amountNumber <= ANCHOR_MAX_TRY && usdcEstimate >= 0.5
  const submit = () =>
    flow.run(async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (!line || !health) throw new Error(t('needLine'))
      setInstruction(null)
      mark(0, 'active')
      const token = await authenticate(signer)
      mark(0, 'done')
      mark(1, 'active')
      const quote = await quoteTryToUsdc(amountNumber)
      const deposit = await startDeposit(token, signer.address, amountNumber)
      setInstruction({ iban: deposit.iban, reference: deposit.reference })
      mark(1, 'done', deposit.reference ? `${t('reference')}: ${deposit.reference}` : deposit.id)
      mark(2, 'active')
      await simulateBankTransfer(token, deposit.id, amountNumber)
      mark(2, 'done')
      mark(3, 'active')
      const settled = await waitForStatus(token, deposit.id, (status) => status === 'completed', (tx) => mark(3, 'active', tx.status))
      if (settled.status !== 'completed') throw new Error(`anchor status ${settled.status}`)
      const received = Number(settled.amountOut ?? quote.buyAmount)
      mark(3, 'done', `${formatAmount(received)} USDC`)
      mark(4, 'active')
      const convertHash = await convertCircleToBlendUsdc(signer, received.toFixed(7))
      mark(4, 'done', txLink(convertHash))
      mark(5, 'active')
      const repayUsdc = Math.min(received, health.debtUsdc * 1.001)
      const fullRepay = received >= health.debtUsdc
      const withdrawXlm = withdrawAll && fullRepay ? health.collateralXlm * 2 : 0
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(withdrawXlm.toFixed(7)))
      mark(5, 'done', txLink(hash))
      mark(6, 'done')
      await refresh()
    })
  return (
    <div className="card">
      <h3 className="text-lg text-ink">{t('repayTitle')}</h3>
      <p className="mt-1 text-sm text-mute">{t('repayBody')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('amountTry')}</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {rate ? `≈ ${formatAmount(usdcEstimate)} USDC` : ''}
            {health ? ` · ${t('debt')}: ${formatAmount(health.debtUsdc)} USDC` : ''}
          </div>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
            <input type="checkbox" checked={withdrawAll} onChange={(e) => setWithdrawAll(e.target.checked)} className="accent-black" />
            {t('withdrawCollateral')}
          </label>
        </div>
      </div>
      <button type="button" className="btn mt-4" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('repay')}
      </button>
      {instruction ? (
        <div className="mt-4 rounded-2xl bg-soft p-4 text-xs text-mute">
          <div>IBAN: {instruction.iban ?? '·'}</div>
          <div>
            {t('reference')}: {instruction.reference ?? '·'}
          </div>
        </div>
      ) : null}
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

export function ActivityList({ events, title }: { events: ActivityEvent[]; title: string }) {
  const { t } = useT()
  return (
    <div className="card">
      <h3 className="text-lg text-ink">{title}</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-mute">{t('noActivity')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {events.slice(0, 12).map((event) => (
            <li key={`${event.txHash}-${event.kind}-${event.ledger}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <span className="text-ink">{t(event.kind)}</span>
                <span className="ml-2 text-xs text-mute">{event.user.slice(0, 4)}…{event.user.slice(-4)}</span>
              </div>
              <div className="text-right text-xs text-mute">
                {event.kind === 'payout'
                  ? `₺${formatAmount(Number(event.a) / 100)}`
                  : event.kind === 'opened'
                    ? `${fromStroops(event.a)} XLM · ${fromStroops(event.b)} USDC`
                    : `${fromStroops(event.a)} USDC · ${fromStroops(event.b)} XLM`}
                <a href={txLink(event.txHash)} target="_blank" rel="noreferrer" className="ml-2 underline">
                  {t('view')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Home() {
  const { t } = useT()
  const { address, signer, connect } = useWallet()
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [line, setLine] = useState<Line | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [reserves, setReserves] = useState<{ xlm: ReserveView; usdc: ReserveView } | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])

  const refresh = useCallback(async () => {
    if (!address) {
      setWallet(null)
      setLine(null)
      setHealth(null)
      return
    }
    const [walletState, lineState, healthState, activity] = await Promise.all([
      getWalletState(address),
      getLine(address).catch(() => null),
      getHealth(address).catch(() => null),
      getActivity().catch(() => []),
    ])
    setWallet(walletState)
    setLine(lineState)
    setHealth(healthState)
    setEvents(activity.filter((event) => event.user === address))
  }, [address])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    getReserves().then(setReserves).catch(() => setReserves(null))
    quoteUsdcToTry(1)
      .then((quote) => setRate(quote.buyAmount))
      .catch(() => setRate(null))
  }, [])

  const shared: Shared = { signer, wallet, line, health, reserves, rate, refresh }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20">
      <section className="py-10 sm:py-14">
        <span className="pill">{t('testnet')}</span>
        <h1 className="mt-4 max-w-3xl text-4xl tracking-tight text-ink sm:text-6xl">{t('tagline')}</h1>
        <p className="mt-4 max-w-2xl text-base text-mute sm:text-lg">{t('subtitle')}</p>
        {!address ? (
          <button type="button" className="btn mt-6" onClick={() => void connect()}>
            {t('connect')}
          </button>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <LineCard {...shared} />
          <ActivityList events={events} title={t('activity')} />
        </div>
        <div className="space-y-5 lg:col-span-3">
          <WalletCard {...shared} />
          <OpenCard {...shared} />
          <CashOutCard {...shared} />
          <RepayCard {...shared} />
        </div>
      </section>

      <section className="mt-16 grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-lg text-ink">{t('how')}</h3>
          <ol className="mt-3 space-y-2 text-sm text-mute">
            {(['how1', 'how2', 'how3', 'how4'] as DictKey[]).map((key, index) => (
              <li key={key} className="flex gap-3">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[10px] text-ink">{index + 1}</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h3 className="text-lg text-ink">{t('integrations')}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Blend v2', 'TR Mock Anchor · SEP-6', 'Stellar Wallets Kit', 'Soroban', 'Reflector USD/TRY'].map((name) => (
              <span key={name} className="pill">
                {name}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-mute">
            <div>
              {t('contract')}:{' '}
              <a className="underline" href={`${EXPLORER_CONTRACT}${CREDIT_LINE_CONTRACT}`} target="_blank" rel="noreferrer">
                {CREDIT_LINE_CONTRACT.slice(0, 8)}…{CREDIT_LINE_CONTRACT.slice(-6)}
              </a>
            </div>
            <div>
              Blend:{' '}
              <a className="underline" href={`${EXPLORER_CONTRACT}${BLEND_POOL}`} target="_blank" rel="noreferrer">
                {BLEND_POOL.slice(0, 8)}…{BLEND_POOL.slice(-6)}
              </a>
            </div>
            <div>
              Anchor:{' '}
              <a className="underline" href={`https://${ANCHOR_HOME_DOMAIN}`} target="_blank" rel="noreferrer">
                {ANCHOR_HOME_DOMAIN}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
