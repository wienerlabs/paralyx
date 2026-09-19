import { NavLink } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { shortAddress, useWallet } from '../lib/wallet'

export function Header() {
  const { t, lang, setLang } = useT()
  const { address, connect, disconnect } = useWallet()
  const link = ({ isActive }: { isActive: boolean }) =>
    'rounded-full px-3 py-1.5 text-sm transition ' + (isActive ? 'bg-ink text-white' : 'text-mute hover:text-ink')
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
      <div className="flex items-center gap-4">
        <NavLink to="/" className="text-xl tracking-tight text-ink">
          Paralyx
        </NavLink>
        <nav className="flex items-center gap-1 rounded-full border border-line p-1">
          <NavLink to="/" className={link} end>
            {t('home')}
          </NavLink>
          <NavLink to="/stats" className={link}>
            {t('stats')}
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-mute transition hover:border-ink hover:text-ink"
        >
          {lang === 'tr' ? 'EN' : 'TR'}
        </button>
        {address ? (
          <button type="button" onClick={() => void disconnect()} className="btn-ghost" title={address}>
            {shortAddress(address)}
          </button>
        ) : (
          <button type="button" onClick={() => void connect()} className="btn">
            {t('connect')}
          </button>
        )}
      </div>
    </header>
  )
}
