import { useEffect, useMemo, useState } from 'react'
import { ensureTrustlines, formatAmount, fromStroops, fundWithFriendbot, openLine, previewBorrowable, toStroops, type ActivityEvent } from '../lib/chain'
import { useT } from '../lib/i18n'
import { CREDIT_LINE_CONTRACT, FRIENDBOT_URL, IS_MAINNET } from '../config'
import { borrowAllowed, supplyAllowed } from '../lib/blend'
import { PoolStatusBadge } from './PoolStatusBadge'
import { useLivePrices } from '../lib/prices'
import { useCached } from '../lib/store'
import { getTryPerUsdHistory, getXlmUsdHistory } from '../lib/reflector'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { PriceChart, type Point } from './PriceChart'
import { Steps } from './Steps'
import { TokenIcon, type TokenSymbol } from './TokenIcon'

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

export function LineCard({ line, health, rate, wallet, poolStatus }: Shared) {
  const { t } = useT()
  const borrowingOpen = poolStatus === null || borrowAllowed(poolStatus)
  const limitTry = health && rate ? health.borrowableUsdc * rate : null
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-mute">
          <TokenIcon symbol="TRY" size={18} />
          {t('limit')}
        </div>
        <PoolStatusBadge status={poolStatus} />
      </div>
      {borrowingOpen ? (
        <div className="mt-2 text-5xl tracking-tight text-ink">{limitTry === null ? '·' : `₺${formatAmount(limitTry, 0)}`}</div>
      ) : (
        <div className="mt-2 text-3xl tracking-tight text-ink">{t('limitClosed')}</div>
      )}
      <div className="mt-1 text-sm text-mute">
        {borrowingOpen && health ? `${formatAmount(health.borrowableUsdc)} USDC` : ''}
        {rate ? `${borrowingOpen && health ? ' · ' : ''}1 USDC ≈ ₺${formatAmount(rate)}` : ''}
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

export function WalletCard({ signer, wallet, refresh }: Shared) {
  const { t } = useT()
  const flow = useFlow()
  if (!signer || !wallet) return null
  const needsXlm = !wallet.exists || wallet.xlm < (IS_MAINNET ? 3 : 20)
  const needsTrust = wallet.blendUsdc === null || (!IS_MAINNET && wallet.circleUsdc === null)
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
        {needsXlm && FRIENDBOT_URL ? (
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

export function OpenCard({ signer, wallet, health, reserves, rate, refresh, poolStatus }: Shared) {
  const { t } = useT()
  const [collateral, setCollateral] = useState('100')
  const [borrow, setBorrow] = useState('10')
  const flow = useFlow()
  const canBorrow = poolStatus === null || borrowAllowed(poolStatus)
  const canSupply = poolStatus === null || supplyAllowed(poolStatus)
  useEffect(() => {
    if (!canBorrow) setBorrow('0')
  }, [canBorrow])
  const maxBorrow = useMemo(() => {
    if (!health || !reserves) return null
    const xlm = Number(collateral.replace(',', '.')) || 0
    return previewBorrowable(xlm, reserves.xlm, reserves.usdc, health)
  }, [collateral, health, reserves])
  const ready = Boolean(signer && wallet?.exists && wallet.blendUsdc !== null && CREDIT_LINE_CONTRACT)
  const borrowNumber = Number(borrow.replace(',', '.')) || 0
  const collateralNumber = Number(collateral.replace(',', '.')) || 0
  const valid =
    ready &&
    canSupply &&
    (canBorrow || borrowNumber === 0) &&
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
          <input className="input disabled:bg-soft disabled:text-mute" inputMode="decimal" value={borrow} disabled={!canBorrow} onChange={(e) => setBorrow(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {!canBorrow ? t('limitClosed') : maxBorrow !== null ? `${t('maxBorrow')} ${formatAmount(maxBorrow)} USDC` : ''}
            {canBorrow && rate && borrowNumber > 0 ? ` · ${t('equalsTry')} ₺${formatAmount(borrowNumber * rate)}` : ''}
          </div>
        </div>
      </div>
      {poolStatus !== null && !canBorrow ? (
        <div className="mt-4 rounded-2xl bg-soft p-4 text-xs text-mute">
          <PoolStatusBadge status={poolStatus} />
          <p className="mt-2">{canSupply ? t('borrowClosedHint') : t('supplyClosedHint')}</p>
          {IS_MAINNET ? <p className="mt-1">{t('borrowClosedMainnetNote')}</p> : null}
        </div>
      ) : null}
      <MotionButton className="mt-4" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {canBorrow ? t('open') : t('collateralOnly')}
      </MotionButton>
      {!CREDIT_LINE_CONTRACT ? <p className="mt-2 text-xs text-mute">{t('contractPending')}</p> : !ready && signer ? <p className="mt-2 text-xs text-mute">{t('walletBody')}</p> : null}
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

export function Charts() {
  const { t } = useT()
  const live = useLivePrices()
  const tryPoints = useCached<Point[]>('chart:try', getTryPerUsdHistory, { ttl: 120_000, persist: true, refreshMs: 120_000 }).data ?? []
  const xlmPoints = useCached<Point[]>('chart:xlm', getXlmUsdHistory, { ttl: 120_000, persist: true, refreshMs: 120_000 }).data ?? []
  const stamp = live.updatedAt ? `${t('live')} · ${new Date(live.updatedAt).toLocaleTimeString('tr-TR')}` : t('live')
  return (
    <>
      <PriceChart
        title={t('chartTry')}
        subtitle={t('chartTrySub')}
        points={tryPoints}
        format={(value) => `₺${formatAmount(value)}`}
        icon={<TokenIcon symbol="TRY" size={32} />}
        footer={spanLabel(tryPoints, t('lastHours'))}
        live={live.tryPerUsd}
        liveLabel={stamp}
      />
      <PriceChart
        title={t('chartXlm')}
        subtitle={t('chartXlmSub')}
        points={xlmPoints}
        format={(value) => `$${formatAmount(value, 4)}`}
        icon={<TokenIcon symbol="XLM" size={32} />}
        footer={spanLabel(xlmPoints, t('lastHours'))}
        live={live.xlmUsd}
        liveLabel={stamp}
      />
    </>
  )
}

