import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useWallet } from '../lib/wallet'

export function ConnectModal() {
  const { t } = useT()
  const { connectOpen, closeConnect, supported, connect, connecting } = useWallet()

  useEffect(() => {
    if (!connectOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConnect()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connectOpen, closeConnect])

  return (
    <AnimatePresence>
      {connectOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeConnect}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl text-ink">{t('connectTitle')}</h2>
                <p className="mt-1 text-sm text-mute">{t('connectBody')}</p>
              </div>
              <button type="button" onClick={closeConnect} className="rounded-full border border-line p-2 text-mute transition hover:border-ink hover:text-ink" aria-label={t('close')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-5 space-y-2">
              {supported.length === 0 ? <li className="rounded-2xl bg-soft p-4 text-sm text-mute">…</li> : null}
              {supported.map((wallet, index) => (
                <motion.li
                  key={wallet.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={connecting !== null}
                    onClick={() => {
                      if (wallet.isAvailable) void connect(wallet)
                      else window.open(wallet.url, '_blank', 'noreferrer')
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left transition hover:border-ink disabled:opacity-50"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                      {wallet.icon ? <img src={wallet.icon} alt="" className="h-6 w-6 object-contain" /> : null}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-ink">{wallet.name}</span>
                      <span className="block text-xs text-mute">{connecting === wallet.id ? t('connecting') : wallet.isAvailable ? t('installed') : t('notInstalled')}</span>
                    </span>
                    <span className="pill">{wallet.isAvailable ? t('connect') : t('install')}</span>
                  </motion.button>
                </motion.li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-mute">
              {t('network')}: Stellar testnet
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
