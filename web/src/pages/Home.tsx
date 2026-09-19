import { useCallback, useEffect, useMemo, useState } from 'react'
import { ANCHOR_HOME_DOMAIN, BLEND_POOL, CREDIT_LINE_CONTRACT, EXPLORER_CONTRACT } from '../config'
import { quoteUsdcToTry } from '../lib/anchor'
import {
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
  previewBorrowable,
  toStroops,
  type ActivityEvent,
  type Health,
  type Line,
  type ReserveView,
  type WalletState,
} from '../lib/chain'
import { useT, type DictKey } from '../lib/i18n'
import { getTryPerUsdHistory, getXlmUsdHistory } from '../lib/reflector'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { useWallet } from '../lib/wallet'
import { ExchangeCard } from '../components/ExchangeCard'
import { MotionButton } from '../components/MotionButton'
import { PriceChart, type Point } from '../components/PriceChart'
import { Steps } from '../components/Steps'
import { TokenIcon, type TokenSymbol } from '../components/TokenIcon'

function Metric({ label, value, hint, symbol }: { label: string; value: string; hint?: string; symbol?: TokenSymbol }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2 text-xs text-mute">
        {symbol ? <TokenIcon symbol={symbol} size={16} /> : null}
        {label}
      </div>
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
      <div className="flex items-center gap-2 text-xs text-mute">
        <TokenIcon symbol="TRY" size={18} />
        {t('limit')}
      </div>
      <div className="mt-2 text-5xl tracking-tight text-ink">{limitTry === null ? '·' : `₺${formatAmount(limitTry, 0)}`}</div>
      <div className="mt-1 text-sm text-mute">
        {health ? `${formatAmount(health.borrowableUsdc)} USDC` : ''}
        {rate ? ` · 1 USDC ≈ ₺${formatAmount(rate)}` : ''}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric
          symbol="XLM"
          label={t('collateral')}
          value={health ? `${formatAmount(health.collateralXlm)} XLM` : '·'}
          hint={health ? `$${formatAmount(health.collateralXlm * health.xlmPrice)}` : undefined}
        />
        <Metric
          symbol="USDC"
          label={t('debt')}
          value={health ? `${formatAmount(health.debtUsdc)} USDC` : '·'}
          hint={health && rate ? `₺${formatAmount(health.debtUsdc * rate)}` : undefined}
        />
        <Metric label={t('health')} value={health ? (health.healthFactor === null ? t('noDebt') : formatAmount(health.healthFactor)) : '·'} />
        <Metric
          symbol="XLM"
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
  const flow = useFlow()
  if (!signer || !wallet) return null
  const needsXlm = !wallet.exists || wallet.xlm < 20
  const needsTrust = wallet.blendUsdc === null || wallet.circleUsdc === null
  if (!needsXlm && !needsTrust) return null
  const fund = () =>
    flow.run(['sending', 'done'], async (mark) => {
      mark(0, 'active')
      await fundWithFriendbot(signer.address)
      mark(0, 'done')
      mark(1, 'done')
      await refresh()
    })
  const trust = () =>
    flow.run(['signing', 'done'], async (mark) => {
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
          <MotionButton disabled={flow.busy} onClick={() => void fund()}>
            <TokenIcon symbol="XLM" size={18} /> {t('fund')}
          </MotionButton>
        ) : null}
        {needsTrust && wallet.exists ? (
          <MotionButton disabled={flow.busy} onClick={() => void trust()}>
            <TokenIcon symbol="USDC" size={18} /> {t('trust')}
          </MotionButton>
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
  const flow = useFlow()
  const maxBorrow = useMemo(() => {
    if (!health || !reserves) return null
    const xlm = Number(collateral.replace(',', '.')) || 0
    return previewBorrowable(xlm, reserves.xlm, reserves.usdc, health)
  }, [collateral, health, reserves])
  const ready = Boolean(signer && wallet?.exists && wallet.blendUsdc !== null)
  const borrowNumber = Number(borrow.replace(',', '.')) || 0
  const collateralNumber = Number(collateral.replace(',', '.')) || 0
  const valid =
    ready &&
    collateralNumber >= 0 &&
    borrowNumber >= 0 &&
    collateralNumber + borrowNumber > 0 &&
    (maxBorrow === null || borrowNumber <= maxBorrow + 1e-9) &&
    (!wallet || collateralNumber <= wallet.xlm - 5)
  const submit = () =>
    flow.run(['signing', 'sending', 'done'], async (mark) => {
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
          <label className="label flex items-center gap-2">
            <TokenIcon symbol="XLM" size={16} /> {t('collateralXlm')}
          </label>
          <input className="input" inputMode="decimal" value={collateral} onChange={(e) => setCollateral(e.target.value)} />
          {wallet ? (
            <div className="mt-1 text-xs text-mute">
              {t('balance')}: {formatAmount(wallet.xlm)} XLM
            </div>
          ) : null}
        </div>
        <div>
          <label className="label flex items-center gap-2">
            <TokenIcon symbol="USDC" size={16} /> {t('borrowUsdc')}
          </label>
          <input className="input" inputMode="decimal" value={borrow} onChange={(e) => setBorrow(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {maxBorrow !== null ? `${t('maxBorrow')} ${formatAmount(maxBorrow)} USDC` : ''}
            {rate && borrowNumber > 0 ? ` · ${t('equalsTry')} ₺${formatAmount(borrowNumber * rate)}` : ''}
          </div>
        </div>
      </div>
      <MotionButton className="mt-4" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('open')}
      </MotionButton>
      {!ready && signer ? <p className="mt-2 text-xs text-mute">{t('walletBody')}</p> : null}
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
              <div className="flex items-center gap-2">
                <TokenIcon symbol={event.kind === 'payout' ? 'TRY' : event.kind === 'opened' ? 'XLM' : 'USDC'} size={20} />
                <span className="text-ink">{t(event.kind)}</span>
                <span className="text-xs text-mute">
                  {event.user.slice(0, 4)}…{event.user.slice(-4)}
                </span>
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

function spanLabel(points: Point[], template: string): string {
  if (points.length < 2) return ''
  const hours = Math.max(1, Math.round((points[points.length - 1].t - points[0].t) / 3_600_000))
  return template.replace('{h}', String(hours))
}

function Charts() {
  const { t } = useT()
  const [tryPoints, setTryPoints] = useState<Point[]>([])
  const [xlmPoints, setXlmPoints] = useState<Point[]>([])
  useEffect(() => {
    getTryPerUsdHistory().then(setTryPoints).catch(() => setTryPoints([]))
    getXlmUsdHistory().then(setXlmPoints).catch(() => setXlmPoints([]))
  }, [])
  return (
    <>
      <PriceChart
        title={t('chartTry')}
        subtitle={t('chartTrySub')}
        points={tryPoints}
        format={(value) => `₺${formatAmount(value)}`}
        icon={<TokenIcon symbol="TRY" size={32} />}
        footer={spanLabel(tryPoints, t('lastHours'))}
      />
      <PriceChart
        title={t('chartXlm')}
        subtitle={t('chartXlmSub')}
        points={xlmPoints}
        format={(value) => `$${formatAmount(value, 4)}`}
        icon={<TokenIcon symbol="XLM" size={32} />}
        footer={spanLabel(xlmPoints, t('lastHours'))}
      />
    </>
  )
}

export function Home() {
  const { t } = useT()
  const { address, signer, openConnect } = useWallet()
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
      setEvents([])
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
          <MotionButton className="mt-6" onClick={openConnect}>
            {t('connect')}
          </MotionButton>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <LineCard {...shared} />
          <Charts />
          <ActivityList events={events} title={t('activity')} />
        </div>
        <div className="space-y-5 lg:col-span-3">
          <WalletCard {...shared} />
          <OpenCard {...shared} />
          <ExchangeCard {...shared} />
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
            {['Blend v2', 'TR Mock Anchor · SEP-6', 'Stellar Wallets Kit', 'Soroban', 'Reflector'].map((name) => (
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
