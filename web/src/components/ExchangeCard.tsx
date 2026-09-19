import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, ChevronDown, RefreshCw } from 'lucide-react'
import { ANCHOR_MAX_TRY, ANCHOR_MAX_USDC } from '../config'
import {
  authenticate,
  quoteTryToUsdc,
  quoteUsdcToTry,
  simulateBankTransfer,
  startDeposit,
  startWithdraw,
  waitForStatus,
  type Quote,
} from '../lib/anchor'
import { convertCircleToBlendUsdc, formatAmount, payAnchorWithBlendUsdc, recordPayout, repayLine, toStroops } from '../lib/chain'
import { useT } from '../lib/i18n'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { Steps } from './Steps'
import { TokenIcon, tokenNames, type TokenSymbol } from './TokenIcon'

type Currency = Extract<TokenSymbol, 'USDC' | 'TRY'>
const currencies: Currency[] = ['USDC', 'TRY']

function money(value: number, currency: Currency, decimals = 2): string {
  return currency === 'TRY' ? `₺${formatAmount(value, decimals)}` : `${formatAmount(value, decimals)} USDC`
}

function CurrencySelector({ value, onChange, disabled }: { value: Currency; onChange: (currency: Currency) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-3 text-base text-ink transition hover:border-ink disabled:opacity-60"
      >
        <TokenIcon symbol={value} size={26} />
        <span>{value === 'TRY' ? '₺ TRY' : 'USDC'}</span>
        <ChevronDown className="h-4 w-4 text-mute" />
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute left-0 z-30 mt-2 w-56 rounded-2xl border border-line bg-white p-1 shadow-lg"
          >
            {currencies.map((currency) => (
              <li key={currency}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(currency)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-soft"
                >
                  <TokenIcon symbol={currency} size={22} />
                  <span>
                    {currency === 'TRY' ? '₺ TRY' : 'USDC'} <span className="text-mute">· {tokenNames[currency]}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function ExchangeCard({ signer, wallet, line, health, rate, refresh }: Shared) {
  const { t } = useT()
  const [from, setFrom] = useState<Currency>('USDC')
  const [amount, setAmount] = useState('10')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [withdrawAll, setWithdrawAll] = useState(true)
  const [spin, setSpin] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const flow = useFlow()
  const to: Currency = from === 'USDC' ? 'TRY' : 'USDC'
  const cashOut = from === 'USDC'
  const numeric = Number(amount.replace(',', '.')) || 0
  const available = wallet?.blendUsdc ?? 0
  const debt = health?.debtUsdc ?? 0

  useEffect(() => {
    if (numeric <= 0) {
      setQuote(null)
      return
    }
    const handle = setTimeout(() => {
      const request = cashOut ? quoteUsdcToTry(numeric) : quoteTryToUsdc(numeric)
      request.then(setQuote).catch(() => setQuote(null))
    }, 350)
    return () => clearTimeout(handle)
  }, [numeric, cashOut])

  useEffect(() => {
    if (!cashOut && rate && debt > 0) {
      setAmount(String(Math.min(ANCHOR_MAX_TRY, Math.ceil(debt * 1.01 * rate))))
    }
    if (cashOut) {
      setAmount(available > 0 ? String(Math.min(available, ANCHOR_MAX_USDC, Math.max(0.5, Math.floor(available * 100) / 100))) : '10')
    }
    setQuote(null)
    setResult(null)
    flow.reset()
  }, [cashOut])

  const displayRate = useMemo(() => {
    if (!rate) return null
    return cashOut ? `1 USDC = ₺${formatAmount(rate)}` : `1 TRY = ${formatAmount(1 / rate, 4)} USDC`
  }, [rate, cashOut])

  const usdcEstimate = !cashOut && rate ? numeric / rate : 0
  const valid = cashOut
    ? Boolean(signer && line) && numeric >= 0.5 && numeric <= Math.min(available, ANCHOR_MAX_USDC)
    : Boolean(signer && line && debt > 0) && numeric >= 50 && numeric <= ANCHOR_MAX_TRY && usdcEstimate >= 0.5

  const total = quote ? quote.buyAmount : rate ? (cashOut ? numeric * rate : numeric / rate) : 0
  const feeValue = quote ? quote.feeTotal : numeric * 0.005

  const handleAmount = (value: string) => {
    if (/^\d*[.,]?\d{0,7}$/.test(value)) setAmount(value)
  }

  const swap = () => {
    setSpin((value) => value + 1)
    setFrom(to)
  }

  const runCashOut = () =>
    flow.run(['anchorAuth', 'anchorQuote', 'anchorWithdraw', 'paying', 'anchorWait', 'recording', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (!line) throw new Error(t('needLine'))
      setResult(null)
      mark(0, 'active')
      const token = await authenticate(signer)
      mark(0, 'done')
      mark(1, 'active')
      const fresh = await quoteUsdcToTry(numeric)
      mark(1, 'done', `₺${formatAmount(fresh.buyAmount)}`)
      mark(2, 'active')
      const instruction = await startWithdraw(token, numeric)
      mark(2, 'done', `memo ${instruction.memo}`)
      mark(3, 'active')
      const hash = await payAnchorWithBlendUsdc(signer, numeric.toFixed(7), instruction.accountId, instruction.memo)
      mark(3, 'done', txLink(hash))
      mark(4, 'active')
      const settled = await waitForStatus(token, instruction.id, (status) => status === 'completed', (tx) => mark(4, 'active', tx.status))
      if (settled.status !== 'completed') throw new Error(`anchor status ${settled.status}`)
      const tryPaid = Number(settled.amountOut ?? fresh.buyAmount)
      mark(4, 'done', `₺${formatAmount(tryPaid)}${settled.externalTransactionId ? ` · ${settled.externalTransactionId}` : ''}`)
      mark(5, 'active')
      const recordHash = await recordPayout(signer, instruction.id, BigInt(Math.round(tryPaid * 100)))
      mark(5, 'done', txLink(recordHash))
      mark(6, 'done')
      setResult(`₺${formatAmount(tryPaid)}${settled.externalTransactionId ? ` · ${t('reference')}: ${settled.externalTransactionId}` : ''}`)
      await refresh()
    })

  const runRepay = () =>
    flow.run(['anchorAuth', 'anchorDeposit', 'anchorBank', 'anchorWait', 'converting', 'sending', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (!line || !health) throw new Error(t('needLine'))
      setResult(null)
      mark(0, 'active')
      const token = await authenticate(signer)
      mark(0, 'done')
      mark(1, 'active')
      const fresh = await quoteTryToUsdc(numeric)
      const deposit = await startDeposit(token, signer.address, numeric)
      mark(1, 'done', deposit.reference ? `${t('reference')}: ${deposit.reference} · IBAN ${deposit.iban ?? ''}` : deposit.id)
      mark(2, 'active')
      await simulateBankTransfer(token, deposit.id, numeric)
      mark(2, 'done')
      mark(3, 'active')
      const settled = await waitForStatus(token, deposit.id, (status) => status === 'completed', (tx) => mark(3, 'active', tx.status))
      if (settled.status !== 'completed') throw new Error(`anchor status ${settled.status}`)
      const received = Number(settled.amountOut ?? fresh.buyAmount)
      mark(3, 'done', `${formatAmount(received)} USDC`)
      mark(4, 'active')
      const repayUsdc = Math.min(received * 0.97, health.debtUsdc * 1.001)
      const convertHash = await convertCircleToBlendUsdc(signer, repayUsdc.toFixed(7), received.toFixed(7))
      mark(4, 'done', txLink(convertHash))
      mark(5, 'active')
      const fullRepay = received * 0.97 >= health.debtUsdc
      const withdrawXlm = withdrawAll && fullRepay ? health.collateralXlm * 1.002 : 0
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(withdrawXlm.toFixed(7)))
      mark(5, 'done', txLink(hash))
      mark(6, 'done')
      setResult(`${formatAmount(repayUsdc)} USDC ${t('repaid')}`)
      await refresh()
    })

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <RefreshCw className="h-5 w-5" />
          {t('exchange')}
        </h3>
        <span className="pill">SEP-6 · tr-mock-anchor</span>
      </div>
      <p className="mt-1 text-sm text-mute">{cashOut ? t('cashOutHint') : t('repayHint')}</p>

      <div className="relative mt-5 flex items-center justify-between rounded-2xl border border-line bg-white p-3">
        <motion.div key={`${spin}-from`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
          <div className="mb-1 pl-1 text-xs text-mute">{t('from')}</div>
          <CurrencySelector value={from} onChange={(currency) => setFrom(currency)} disabled={flow.busy} />
        </motion.div>
        <motion.button
          type="button"
          onClick={swap}
          disabled={flow.busy}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: spin * 180 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="absolute left-1/2 top-1/2 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm transition hover:border-ink disabled:opacity-50"
          aria-label={t('swap')}
        >
          <ArrowRightLeft className="h-4 w-4" />
        </motion.button>
        <motion.div key={`${spin}-to`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="text-right">
          <div className="mb-1 pr-1 text-xs text-mute">{t('to')}</div>
          <div className="flex justify-end">
            <CurrencySelector value={to} onChange={(currency) => setFrom(currency === 'USDC' ? 'TRY' : 'USDC')} disabled={flow.busy} />
          </div>
        </motion.div>
      </div>

      <div className="relative mt-6 text-center">
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl text-ink opacity-[0.06]">
          {from === 'TRY' ? '₺' : 'USDC'}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => handleAmount(event.target.value)}
          disabled={flow.busy}
          placeholder="0,00"
          className="w-full bg-transparent text-center text-6xl tracking-tight text-ink outline-none placeholder:text-mute"
        />
        <p className="mt-1 text-sm text-mute">
          {cashOut
            ? `${t('available')}: ${formatAmount(available)} USDC`
            : debt > 0
              ? `${t('debt')}: ${formatAmount(debt)} USDC ≈ ₺${formatAmount(rate ? debt * rate : 0)}`
              : t('noDebtHint')}
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-soft px-4 py-2 text-center text-sm text-mute">{displayRate ?? '·'}</div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-mute">{t('fee')} (0,5%)</span>
          <span className="text-ink">{money(feeValue, from, 4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-mute">{t('networkFee')}</span>
          <span className="inline-flex items-center gap-1 text-ink">
            <TokenIcon symbol="XLM" size={14} /> 0,0001 XLM
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="text-ink">{t('total')}</span>
          <span className="inline-flex items-center gap-2 text-lg text-ink">
            <TokenIcon symbol={to} size={20} />
            {money(total, to, to === 'TRY' ? 2 : 4)}
          </span>
        </div>
      </div>

      {!cashOut ? (
        <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
          <input type="checkbox" checked={withdrawAll} onChange={(event) => setWithdrawAll(event.target.checked)} className="accent-black" />
          {t('withdrawCollateral')}
        </label>
      ) : null}

      <MotionButton full className="mt-5 py-3 text-base" disabled={!valid || flow.busy} onClick={() => void (cashOut ? runCashOut() : runRepay())}>
        <RefreshCw className={`h-4 w-4 ${flow.busy ? 'animate-spin' : ''}`} />
        {cashOut ? t('cashOutAction') : t('repayAction')}
      </MotionButton>
      {!line && signer ? <p className="mt-2 text-xs text-mute">{t('needLine')}</p> : null}
      <Steps steps={flow.steps} />
      {result ? <div className="mt-4 rounded-2xl bg-soft p-4 text-sm text-ink">{result}</div> : null}
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
      <p className="mt-3 text-xs text-mute">{t('seamHint')}</p>
    </div>
  )
}
