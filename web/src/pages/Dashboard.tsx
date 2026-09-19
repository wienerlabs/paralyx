import { ArrowDownToLine, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ActivityList, Charts, LineCard, WalletCard } from '../components/cards'
import { MotionButton } from '../components/MotionButton'
import { useT } from '../lib/i18n'
import { useShared } from '../lib/useShared'
import { useWallet } from '../lib/wallet'

export function Dashboard() {
  const { t } = useT()
  const shared = useShared()
  const { address, openConnect } = useWallet()
  const navigate = useNavigate()
  return (
    <div>
      <section className="pb-6">
        <span className="pill">{t('testnet')}</span>
        <h1 className="mt-3 text-3xl tracking-tight text-ink sm:text-5xl">{t('tagline')}</h1>
        <p className="mt-3 max-w-2xl text-base text-mute">{t('subtitle')}</p>
        {!address ? (
          <MotionButton className="mt-5" onClick={openConnect}>
            {t('connect')}
          </MotionButton>
        ) : null}
      </section>
      <section className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <LineCard {...shared} />
          <div className="card">
            <h3 className="text-lg text-ink">{t('quickActions')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <MotionButton onClick={() => navigate('/open')}>
                <ArrowDownToLine className="h-4 w-4" /> {t('goOpen')}
              </MotionButton>
              <MotionButton variant="ghost" onClick={() => navigate('/exchange')}>
                <RefreshCw className="h-4 w-4" /> {t('goExchange')}
              </MotionButton>
            </div>
          </div>
          <WalletCard {...shared} />
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
