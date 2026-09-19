import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ActivityList, Charts, LineCard, WalletCard } from '../components/cards'
import { LiveMarketCard } from '../components/LiveMarketCard'
import { MotionButton } from '../components/MotionButton'
import { TokenIcon } from '../components/TokenIcon'
import { hourlyBuckets, TrendCard } from '../components/TrendCard'
import { getPoolOverview, type PoolOverview } from '../lib/blend'
import { IS_MAINNET } from '../config'
import { useT } from '../lib/i18n'
import { useLivePrices } from '../lib/prices'
import { useShared } from '../lib/useShared'
import { useWallet } from '../lib/wallet'

export function Dashboard() {
  const { t } = useT()
  const shared = useShared()
  const { address, openConnect } = useWallet()
  const navigate = useNavigate()
  const live = useLivePrices()
  const [overview, setOverview] = useState<PoolOverview | null>(null)

  useEffect(() => {
    const load = () => getPoolOverview().then(setOverview).catch(() => undefined)
    void load()
    const timer = setInterval(() => void load(), 60_000)
    return () => clearInterval(timer)
  }, [])

  const lineBuckets = useMemo(
    () => hourlyBuckets(shared.allEvents.filter((event) => event.kind === 'opened').map((event) => ({ closedAt: event.closedAt, value: 1 }))),
    [shared.allEvents],
  )
  const linesTotal = shared.allEvents.filter((event) => event.kind === 'opened').length
  const linesLastHour = lineBuckets[lineBuckets.length - 1]?.value ?? 0

  return (
    <div>
      <section className="grid gap-6 pb-8 lg:grid-cols-5">
        <div className="flex flex-col justify-center py-4 lg:col-span-3">
          <span className="pill">{IS_MAINNET ? t('mainnetNotice') : t('heroKicker')}</span>
          <h1 className="mt-4 max-w-2xl text-4xl tracking-tight text-ink sm:text-6xl">{t('tagline')}</h1>
          <p className="mt-4 max-w-xl text-base text-mute sm:text-lg">{t('subtitle')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {address ? (
              <MotionButton onClick={() => navigate('/open')}>
                <ArrowDownToLine className="h-4 w-4" /> {t('goOpen')}
              </MotionButton>
            ) : (
              <MotionButton onClick={openConnect}>{t('connect')}</MotionButton>
            )}
            <MotionButton variant="ghost" onClick={() => navigate('/exchange')}>
              <RefreshCw className="h-4 w-4" /> {t('goExchange')}
            </MotionButton>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-mute">
            <span className="mr-1">{t('builtOn')}</span>
            <span className="pill">
              <TokenIcon symbol="USDC" size={14} className="mr-1.5" /> Blend v2
            </span>
            <span className="pill">
              <TokenIcon symbol="TRY" size={14} className="mr-1.5" /> SEP-6 anchor
            </span>
            <span className="pill">
              <TokenIcon symbol="XLM" size={14} className="mr-1.5" /> Soroban
            </span>
            <span className="pill">Stellar Wallets Kit</span>
            <span className="pill">Reflector</span>
          </div>
        </div>
        <div className="lg:col-span-2">
          <LiveMarketCard live={live} overview={overview} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <LineCard {...shared} />
          <WalletCard {...shared} />
          <TrendCard
            title={t('trendLines')}
            subtitle={t('trendSub')}
            data={lineBuckets}
            totalLabel={t('totalLabel')}
            totalValue={String(linesTotal)}
            newLabel={t('lastHour')}
            newValue={String(linesLastHour)}
            format={(value) => String(Math.round(value))}
          />
        </div>
        <div className="space-y-5 lg:col-span-3">
          <div className="grid gap-5 md:grid-cols-2">
            <Charts />
          </div>
          <ActivityList events={shared.events} title={t('activity')} />
        </div>
      </section>
    </div>
  )
}
