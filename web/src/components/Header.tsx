import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { formatAmount, getWalletState, type WalletState } from '../lib/chain'
import { useT } from '../lib/i18n'
import { shortAddress, useWallet } from '../lib/wallet'
import { MotionButton } from './MotionButton'
import { TokenIcon } from './TokenIcon'

function WalletMenu() {
  const { t } = useT()
  const { address, walletName, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<WalletState | null>(null)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !address) return
    getWalletState(address).then(setState).catch(() => setState(null))
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open, address])

  if (!address) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <MotionButton variant="ghost" onClick={() => setOpen((value) => !value)} title={address}>
        <span className="inline-block h-2 w-2 rounded-full bg-ink" />
        {shortAddress(address)}
      </MotionButton>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute right-0 z-40 mt-2 w-72 rounded-3xl border border-line bg-white p-4 shadow-lg"
          >
            <div className="text-xs text-mute">{walletName ?? t('wallets')} · Stellar testnet</div>
            <div className="mt-1 break-all text-sm text-ink">{address}</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-mute">
                  <TokenIcon symbol="XLM" size={18} /> XLM
                </span>
                <span className="text-ink">{state ? formatAmount(state.xlm) : '·'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-mute">
                  <TokenIcon symbol="USDC" size={18} /> USDC
                </span>
                <span className="text-ink">{state && state.blendUsdc !== null ? formatAmount(state.blendUsdc) : '·'}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <MotionButton variant="ghost" className="flex-1" onClick={() => void copy()}>
                <Copy className="h-4 w-4" /> {copied ? t('copied') : t('copyAddress')}
              </MotionButton>
              <MotionButton variant="ghost" onClick={() => void disconnect()} aria-label={t('disconnect')}>
                <LogOut className="h-4 w-4" />
              </MotionButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function Header() {
  const { t, lang, setLang } = useT()
  const { address, openConnect } = useWallet()
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
  )
}
