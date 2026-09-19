import { useEffect, useMemo, useState } from 'react'
import { BLEND_POOL, CREDIT_LINE_CONTRACT, EXPLORER_CONTRACT, IS_MAINNET } from '../config'
import { borrowAllowed, getPoolOverview, poolStatusKey, supplyAllowed, type PoolOverview } from '../lib/blend'
import { PoolStatusBadge } from '../components/PoolStatusBadge'
import { formatAmount, getActivity, type ActivityEvent } from '../lib/chain'
import { useT } from '../lib/i18n'
import { PriceChart, type Point } from '../components/PriceChart'
import { TokenIcon } from '../components/TokenIcon'
import { hourlyBuckets, TrendCard } from '../components/TrendCard'

function cumulative(events: ActivityEvent[], pick: (event: ActivityEvent) => number): Point[] {
  const ordered = [...events].sort((a, b) => a.ledger - b.ledger)
  let running = 0
  const points = ordered.map((event) => {
    running += pick(event)
    return { t: event.ledger, v: running }
  })
  if (points.length === 1) points.unshift({ t: points[0].t - 1, v: 0 })
  return points
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function usd(value: number): string {
  return value >= 1_000_000 ? `$${formatAmount(value / 1_000_000)}M` : `$${formatAmount(value, 0)}`
}

export function Market() {
  const { t } = useT()
  const [overview, setOverview] = useState<PoolOverview | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [pool, activity] = await Promise.all([getPoolOverview(), getActivity().catch(() => [])])
        if (cancelled) return
        setOverview(pool)
        setEvents(activity)
        setError(null)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      }
    }
    void load()
    const timer = setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const tryPoints = useMemo(() => cumulative(events.filter((event) => event.kind === 'payout'), (event) => Number(event.a) / 100), [events])
  const payoutBuckets = useMemo(
    () => hourlyBuckets(events.filter((event) => event.kind === 'payout').map((event) => ({ closedAt: event.closedAt, value: Number(event.a) / 100 }))),
    [events],
  )
  const payoutTotal = events.filter((event) => event.kind === 'payout').reduce((sum, event) => sum + Number(event.a) / 100, 0)
  const payoutLastHour = payoutBuckets[payoutBuckets.length - 1]?.value ?? 0
  const usdcPoints = useMemo(() => cumulative(events.filter((event) => event.kind === 'opened'), (event) => Number(event.b) / 10_000_000), [events])

  const cards = [
    { label: t('poolSupplied'), value: overview ? usd(overview.totalSuppliedUsd) : '·' },
    { label: t('poolBorrowed'), value: overview ? usd(overview.totalBorrowedUsd) : '·' },
    { label: t('utilization'), value: overview ? pct(overview.utilization) : '·' },
    { label: t('paralyxShare'), value: overview ? String(overview.lineCount) : '·' },
  ]

  return (
    <div>
      <section className="pb-6">
        <h1 className="text-3xl tracking-tight text-ink sm:text-4xl">{t('marketTitle')}</h1>
        <p className="mt-2 max-w-2xl text-base text-mute">{IS_MAINNET ? t('marketSubtitleMainnet') : t('marketSubtitle')}</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className="text-xs text-mute">{card.label}</div>
            <div className="mt-2 text-3xl tracking-tight text-ink">{card.value}</div>
          </div>
        ))}
      </section>
      <section className="card mt-5 overflow-x-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg text-ink">{IS_MAINNET ? t('poolNameMainnet') : t('poolNameTestnet')}</h3>
            <PoolStatusBadge status={overview?.status ?? null} />
          </div>
          <a className="text-xs text-mute underline" href={`${EXPLORER_CONTRACT}${BLEND_POOL}`} target="_blank" rel="noreferrer">
            {BLEND_POOL.slice(0, 8)}…{BLEND_POOL.slice(-6)}
          </a>
        </div>
        <table className="mt-4 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-mute">
              <th className="pb-3 font-light">{t('asset')}</th>
              <th className="pb-3 font-light">{t('price')}</th>
              <th className="pb-3 font-light">{t('supplied')}</th>
              <th className="pb-3 font-light">{t('supplyApr')}</th>
              <th className="pb-3 font-light">{t('borrowed')}</th>
              <th className="pb-3 font-light">{t('borrowApr')}</th>
              <th className="pb-3 font-light">{t('utilization')}</th>
              <th className="pb-3 font-light">{t('collateralFactor')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(overview?.reserves ?? []).map((row) => (
              <tr key={row.asset}>
                <td className="py-3">
                  <span className="inline-flex items-center gap-3">
                    <TokenIcon symbol={row.symbol} size={30} />
                    <span>
                      <span className="block text-ink">{row.label}</span>
                      <span className="block text-xs text-mute">{row.asset.slice(0, 6)}…{row.asset.slice(-4)}</span>
                    </span>
                  </span>
                </td>
                <td className="py-3 text-ink">${formatAmount(row.price, row.price < 1 ? 4 : 2)}</td>
                <td className="py-3">
                  <span className="block text-ink">
                    {formatAmount(row.supplied, 0)} {row.label}
                  </span>
                  <span className="block text-xs text-mute">{usd(row.suppliedUsd)}</span>
                </td>
                <td className="py-3 text-ink">{pct(row.supplyApr)}</td>
                <td className="py-3">
                  <span className="block text-ink">
                    {formatAmount(row.borrowed, 0)} {row.label}
                  </span>
                  <span className="block text-xs text-mute">{usd(row.borrowedUsd)}</span>
                </td>
                <td className="py-3 text-ink">{pct(row.borrowApr)}</td>
                <td className="py-3 text-ink">{pct(row.utilization)}</td>
                <td className="py-3 text-ink">{pct(row.cFactor)}</td>
              </tr>
            ))}
            {!overview && !error ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-mute">
                  ·
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-mute">{t('ratesHint')}</p>
        {overview && !borrowAllowed(overview.status) ? (
          <div className="mt-3 rounded-2xl bg-soft p-4 text-xs text-mute">
            <div className="text-ink">{t(poolStatusKey(overview.status))}</div>
            <p className="mt-1">{supplyAllowed(overview.status) ? t('borrowClosedHint') : t('supplyClosedHint')}</p>
            {IS_MAINNET ? <p className="mt-1">{t('borrowClosedMainnetNote')}</p> : null}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-ink">{error}</p> : null}
      </section>
      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg text-ink">{t('protocolTitle')}</h3>
          <a className="text-xs text-mute underline" href={`${EXPLORER_CONTRACT}${CREDIT_LINE_CONTRACT}`} target="_blank" rel="noreferrer">
            {CREDIT_LINE_CONTRACT.slice(0, 8)}…{CREDIT_LINE_CONTRACT.slice(-6)}
          </a>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <TrendCard
            title={t('trendPayouts')}
            subtitle={t('trendSub')}
            data={payoutBuckets}
            totalLabel={t('totalLabel')}
            totalValue={`₺${formatAmount(payoutTotal)}`}
            newLabel={t('lastHour')}
            newValue={`₺${formatAmount(payoutLastHour)}`}
            format={(value) => `₺${formatAmount(value)}`}
          />
          <PriceChart
            title={t('cumulativeTry')}
            subtitle={t('fromEvents')}
            points={tryPoints}
            format={(value) => `₺${formatAmount(value)}`}
            icon={<TokenIcon symbol="TRY" size={32} />}
            footer=""
          />
          <PriceChart
            title={t('cumulativeUsdc')}
            subtitle={t('fromEvents')}
            points={usdcPoints}
            format={(value) => `${formatAmount(value)} USDC`}
            icon={<TokenIcon symbol="USDC" size={32} />}
            footer=""
          />
        </div>
      </section>
    </div>
  )
}
