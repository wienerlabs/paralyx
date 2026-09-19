import { motion } from 'framer-motion'
import { Activity, ArrowDownToLine, LayoutDashboard, LineChart, RefreshCw } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useT, type DictKey } from '../lib/i18n'
import { shortAddress, useWallet } from '../lib/wallet'
import { MotionButton } from './MotionButton'
import { WalletMenu } from './Header'

interface Item {
  to: string
  label: DictKey
  icon: typeof LayoutDashboard
}

const main: Item[] = [
  { to: '/', label: 'navDashboard', icon: LayoutDashboard },
  { to: '/market', label: 'navMarket', icon: LineChart },
  { to: '/activity', label: 'navActivity', icon: Activity },
]

const explore: Item[] = [
  { to: '/open', label: 'navOpen', icon: ArrowDownToLine },
  { to: '/exchange', label: 'navExchange', icon: RefreshCw },
]

function NavItem({ item }: { item: Item }) {
  const { t } = useT()
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.to === '/'}>
      {({ isActive }) => (
        <motion.span
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className={
            'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ' +
            (isActive ? 'bg-ink text-white' : 'text-mute hover:bg-soft hover:text-ink')
          }
        >
          <Icon className="h-4 w-4" />
          {t(item.label)}
        </motion.span>
      )}
    </NavLink>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useT()
  const { address, openConnect } = useWallet()
  return (
    <div className="min-h-screen bg-white text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
        <NavLink to="/" className="px-3 text-xl tracking-tight text-ink">
          Paralyx
        </NavLink>
        <div className="mt-8 space-y-1">
          {main.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>
        <div className="mt-8 px-3 text-xs text-mute">{t('navExplore')}</div>
        <div className="mt-2 space-y-1">
          {explore.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>
        <div className="mt-auto space-y-2 px-3 text-xs text-mute">
          <span className="pill">{t('testnet')}</span>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-5 py-3 backdrop-blur">
          <NavLink to="/" className="text-lg tracking-tight text-ink lg:hidden">
            Paralyx
          </NavLink>
          <div className="hidden text-sm text-mute lg:block">{t('tagline')}</div>
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-mute transition hover:border-ink hover:text-ink"
            >
              {lang === 'tr' ? 'EN' : 'TR'}
            </motion.button>
            {address ? <WalletMenu /> : <MotionButton onClick={openConnect}>{t('connect')}</MotionButton>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 lg:pb-16">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-line bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        {[...main, ...explore].map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="flex-1">
              {({ isActive }) => (
                <span className={'flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] ' + (isActive ? 'text-ink' : 'text-mute')}>
                  <Icon className="h-4 w-4" />
                  {t(item.label)}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
      {address ? <span className="sr-only">{shortAddress(address)}</span> : null}
    </div>
  )
}
