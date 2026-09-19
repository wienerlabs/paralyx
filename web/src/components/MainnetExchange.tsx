import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Banknote, Bookmark, BookmarkCheck, Building2, ShieldCheck, X } from 'lucide-react'
import { Asset, Memo } from '@stellar/stellar-sdk'
import { USDT0_TRANSFER_URL, type SavedAccount } from '../config'
import { blendUsdcAsset, checkDestination, convertUsdt0ToUsdc, ensureTrustlines, formatAmount, quoteStrictSend, repayLine, sendToExchange, toStroops, usdt0Asset, type DestinationCheck } from '../lib/chain'
import { lookupDirectory, type DirectoryEntry } from '../lib/directory'
import { addHistory } from '../lib/history'
import { removeAccount, saveAccount, useSavedAccounts } from '../lib/savedAccounts'
import { useT } from '../lib/i18n'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { Steps } from './Steps'
import { TokenIcon } from './TokenIcon'
import { AmountField, Blocker, CopyButton, Details, ModeSwitch, QuoteBar, Receipt, type ReceiptRow } from './exchange/primitives'

type Mode = 'exchange' | 'usdt0' | 'usdc'

interface ReceiptData {
  title: string
  rows: ReceiptRow[]
  links: { label: string; href: string }[]
  note?: string
}

interface ExchangePreset {
  id: string
  name: string
  match: string
  logo: string
  url: string
  deposit?: string
  knownDeposits?: string[]
}

const exchanges: ExchangePreset[] = [
  {
    id: 'paribu',
    name: 'Paribu',
    match: 'paribu',
    logo: '/exchanges/paribu.png',
    url: 'https://www.paribu.com',
    deposit: 'GAMZLXGVGEQBBPLL7SQK4GJHBIHLMX5PHLC2WDQEGWFLENFO2NXQNAGH',
    knownDeposits: ['GAMZLXGVGEQBBPLL7SQK4GJHBIHLMX5PHLC2WDQEGWFLENFO2NXQNAGH', 'GBZLHGDYMSVF4X6DYAGKLIQX3F64W3MXNDVGHKQPR226TCJ5QJ2ZQKVA'],
  },
  { id: 'btcturk', name: 'BtcTurk', match: 'btcturk', logo: '/exchanges/btcturk.png', url: 'https://www.btcturk.com' },
  { id: 'binance', name: 'Binance TR', match: 'binance', logo: '/exchanges/binance.png', url: 'https://www.binance.tr' },
  { id: 'okx', name: 'OKX TR', match: 'okx', logo: '/exchanges/okx.png', url: 'https://tr.okx.com' },
  { id: 'bitci', name: 'Bitci', match: 'bitci', logo: '/exchanges/bitci.png', url: 'https://www.bitci.com' },
  { id: 'icrypex', name: 'Icrypex', match: 'icrypex', logo: '/exchanges/icrypex.png', url: 'https://www.icrypex.com' },
  { id: 'bitexen', name: 'Bitexen', match: 'bitexen', logo: '/exchanges/bitexen.png', url: 'https://www.bitexen.com' },
]

interface DestinationState {
  address: string
  horizon: DestinationCheck
  directory: DirectoryEntry | null | undefined
}

function ExchangeLogo({ preset, size = 22 }: { preset: ExchangePreset | null; size?: number }) {
  if (!preset) return <Building2 className="h-4 w-4" />
  return <img src={preset.logo} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} draggable={false} />
}

function useQuote(loader: (value: number) => Promise<number | null>) {
  const [quote, setQuote] = useState<{ value: number; at: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const fetch = useCallback(
    async (value: number) => {
      if (value <= 0) {
        setQuote(null)
        return
      }
      requestId.current += 1
      const id = requestId.current
      setLoading(true)
      try {
        const result = await loader(value)
        if (id === requestId.current) setQuote(result === null ? null : { value: result, at: Date.now() })
      } catch {
        if (id === requestId.current) setQuote(null)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [loader],
  )
  return { quote, loading, fetch, reset: () => setQuote(null) }
}

function ExchangeCashOut({ signer, wallet, rate, refresh }: Shared) {
  const { t } = useT()
  const [exchangeId, setExchangeId] = useState<string>('paribu')
  const [destination, setDestination] = useState<string>(exchanges[0].deposit ?? '')
  const [memoType, setMemoType] = useState<'id' | 'text'>('id')
  const [memoValue, setMemoValue] = useState('')
  const [amount, setAmount] = useState('10')
  const [check, setCheck] = useState<DestinationState | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [activeSaved, setActiveSaved] = useState<string | null>(null)
  const flow = useFlow()
  const savedAccounts = useSavedAccounts()
  const quoteLoader = useCallback((value: number) => quoteStrictSend(blendUsdcAsset, value.toFixed(7), Asset.native()), [])
  const xlm = useQuote(quoteLoader)
  const preset = exchanges.find((entry) => entry.id === exchangeId) ?? null
  const numeric = Number(amount) || 0
  const available = wallet?.blendUsdc ?? 0
  const trimmed = destination.trim()
  const validAddress = /^G[A-Z2-7]{55}$/.test(trimmed)
  const isSelf = signer ? trimmed === signer.address : false
  const current = check && check.address === trimmed ? check : null
  const exists = current?.horizon.exists ?? false
  const directory = current?.directory
  const knownDeposit = Boolean(preset?.knownDeposits?.includes(trimmed))
  const mismatch = Boolean(preset && directory && directory.domain && !directory.domain.toLowerCase().includes(preset.match))
  const verified = exists && !isSelf && !mismatch
  const memoRequired = exists && (knownDeposit || (current?.horizon.memoRequired ?? false) || (directory?.tags.includes('memo-required') ?? false))
  const memoBytes = new TextEncoder().encode(memoValue.trim()).length
  const validMemo = memoType === 'id' ? /^\d+$/.test(memoValue.trim()) : memoValue.trim().length > 0 && memoBytes <= 28
  const minXlm = xlm.quote ? xlm.quote.value * 0.99 : null
  const presetFilled = Boolean(preset?.deposit && trimmed === preset.deposit)

  useEffect(() => {
    const handle = setTimeout(() => void xlm.fetch(numeric), 400)
    return () => clearTimeout(handle)
  }, [numeric, xlm.fetch])

  useEffect(() => {
    setConfirmed(false)
  }, [trimmed, exchangeId])

  useEffect(() => {
    const active = savedAccounts.find((account) => account.id === activeSaved)
    if (active && (active.address !== trimmed || active.memo !== memoValue.trim())) setActiveSaved(null)
  }, [trimmed, memoValue, activeSaved, savedAccounts])

  const verify = useCallback(async (address: string) => {
    if (!/^G[A-Z2-7]{55}$/.test(address)) return
    setChecking(true)
    try {
      const [horizon, dir] = await Promise.all([checkDestination(address), lookupDirectory(address).catch(() => undefined)])
      setCheck({ address, horizon, directory: dir })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const initial = exchanges[0].deposit
    if (initial) void verify(initial)
  }, [verify])

  const onMemoChange = (value: string) => {
    setMemoValue(value)
    if (memoType === 'text' && /^\d{1,19}$/.test(value.trim()) && value.trim().length > 0) setMemoType('id')
  }

  const choose = (entry: ExchangePreset | null) => {
    setExchangeId(entry?.id ?? 'other')
    setReceipt(null)
    setActiveSaved(null)
    if (entry?.deposit) {
      setDestination(entry.deposit)
      void verify(entry.deposit)
    } else if (preset?.deposit && trimmed === preset.deposit) {
      setDestination('')
      setCheck(null)
    }
  }

  const useSaved = (account: SavedAccount) => {
    setExchangeId(account.exchangeId)
    setDestination(account.address)
    setMemoType(account.memoType)
    setMemoValue(account.memo)
    setActiveSaved(account.id)
    setReceipt(null)
    void verify(account.address)
  }

  const persistCurrent = () => {
    if (!validAddress || !validMemo) return
    const entry = saveAccount({ exchangeId: preset?.id ?? 'other', label: `${preset?.name ?? t('exchangeOther')} · ${memoValue.trim()}`, address: trimmed, memoType, memo: memoValue.trim() })
    setActiveSaved(entry.id)
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2000)
  }

  const amountError = wallet && numeric > 0 && numeric > available ? t('reasonBalance') : null
  const reasons: string[] = []
  if (!signer) reasons.push(t('reasonWallet'))
  if (numeric <= 0) reasons.push(t('reasonAmount'))
  if (!validAddress || !verified) reasons.push(t('reasonAddress'))
  if (!validMemo) reasons.push(t('reasonMemo'))
  if (numeric > 0 && !amountError && minXlm === null) reasons.push(t('reasonQuote'))
  if (verified && validMemo && !confirmed) reasons.push(t('reasonConfirm'))
  const valid = reasons.length === 0 && !amountError && !flow.busy

  const submit = () =>
    flow.run(['verifying', 'signing', 'sending', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (minXlm === null) throw new Error(t('reasonQuote'))
      setReceipt(null)
      mark(0, 'active')
      const fresh = await checkDestination(trimmed)
      if (!fresh.exists) throw new Error(t('destinationMissing'))
      mark(0, 'done', `${preset?.name ?? t('exchangeOther')} · ${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`)
      mark(1, 'active')
      const memo = memoType === 'id' ? Memo.id(memoValue.trim()) : Memo.text(memoValue.trim())
      const hash = await sendToExchange(signer, numeric.toFixed(7), trimmed, memo, minXlm.toFixed(7))
      mark(1, 'done')
      mark(2, 'done', txLink(hash))
      mark(3, 'done')
      setConfirmed(false)
      const links = [{ label: t('view'), href: txLink(hash) }, ...(preset ? [{ label: t('sellAtExchange'), href: preset.url }] : [])]
      setReceipt({
        title: t('receiptExchange'),
        rows: [
          { label: t('sentUsdc'), value: `${formatAmount(numeric)} USDC` },
          { label: t('minReceived'), value: `${formatAmount(minXlm, 2)} XLM` },
          { label: t('toExchange'), value: `${preset?.name ?? t('exchangeOther')} · ${trimmed.slice(0, 6)}…${trimmed.slice(-6)}`, copy: trimmed },
          { label: t('exchangeMemo'), value: `${memoType} · ${memoValue.trim()}`, copy: memoValue.trim() },
        ],
        links,
        note: t('exchangeSteps'),
      })
      addHistory(signer.address, { kind: 'exchange', title: `${t('receiptExchange')} · ${preset?.name ?? t('exchangeOther')}`, amount: `${formatAmount(numeric)} USDC`, detail: `≥ ${formatAmount(minXlm, 2)} XLM`, links })
      await refresh()
    })

  const shortAddress = validAddress ? `${trimmed.slice(0, 6)}…${trimmed.slice(-6)}` : '·'
  const statusLine = isSelf
    ? t('destinationIsYou')
    : current
      ? !current.horizon.exists
        ? t('destinationMissing')
        : mismatch
          ? t('directoryMismatch')
          : `${t('destinationOk')} · ${knownDeposit ? t('knownDeposit') : directory ? `${t('directoryListed')}: ${directory.name}${directory.domain ? ` (${directory.domain})` : ''}${directory.tags.length ? ` · ${directory.tags.join(', ')}` : ''}` : t('directoryNotListed')}`
      : ''
  const activeAccount = savedAccounts.find((account) => account.id === activeSaved) ?? null

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">{t('exchangeCashBody')}</p>
      <div>
        <label className="label">{t('exchangePickTitle')}</label>
        <div className="flex flex-wrap gap-2">
          {exchanges.map((entry) => (
            <motion.button
              key={entry.id}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => choose(entry)}
              className={
                'inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition ' +
                (exchangeId === entry.id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-accent-strong')
              }
            >
              <ExchangeLogo preset={entry} />
              {entry.name}
            </motion.button>
          ))}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => choose(null)}
            className={
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ' +
              (exchangeId === 'other' ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-accent-strong')
            }
          >
            <Building2 className="h-4 w-4" /> {t('exchangeOther')}
          </motion.button>
        </div>
        {preset ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
            <a className="inline-flex items-center gap-1 underline hover:text-ink" href={preset.url} target="_blank" rel="noreferrer">
              <ExchangeLogo preset={preset} size={14} /> {t('openExchange')} <ArrowUpRight className="h-3 w-3" />
            </a>
            <span>{t('memoFromExchange')}</span>
          </div>
        ) : null}
      </div>

      {savedAccounts.length > 0 ? (
        <div>
          <label className="label">{t('savedAccounts')}</label>
          <div className="flex flex-wrap gap-2">
            {savedAccounts.map((account) => {
              const accountPreset = exchanges.find((entry) => entry.id === account.exchangeId) ?? null
              const active = account.id === activeSaved
              return (
                <span key={account.id} className={'inline-flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-1.5 text-sm transition ' + (active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-accent-strong')}>
                  <button type="button" onClick={() => useSaved(account)} className="inline-flex items-center gap-2" title={`${account.address} · memo ${account.memo}`}>
                    <ExchangeLogo preset={accountPreset} size={20} />
                    {active ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    {account.label}
                  </button>
                  {account.builtIn ? null : (
                    <button type="button" onClick={() => removeAccount(account.id)} className="ml-1 rounded-full p-0.5 text-mute hover:text-ink" title={t('removeSaved')} aria-label={t('removeSaved')}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
          {activeAccount ? (
            <div className="mt-1 text-xs text-mute">
              {t('usingSaved')}: {activeAccount.label}
              {activeAccount.builtIn ? ` · ${t('builtInAccount')}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="label">{t('exchangeAddress')}</label>
        <div className="flex gap-2">
          <input className="input font-mono text-sm" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="G…" spellCheck={false} />
          <MotionButton variant="ghost" className="shrink-0" disabled={!validAddress || checking || isSelf} onClick={() => void verify(trimmed)}>
            <ShieldCheck className="h-4 w-4" /> {checking ? t('verifying') : t('verifyDestination')}
          </MotionButton>
        </div>
        <div className={'mt-1 text-xs ' + (mismatch || (current && !current.horizon.exists) ? 'text-ink' : 'text-mute')}>
          {presetFilled && verified ? `${t('presetFilled')} ` : ''}
          {statusLine}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">{t('exchangeMemo')}</label>
          <select className="input" value={memoType} onChange={(event) => setMemoType(event.target.value as 'id' | 'text')}>
            <option value="id">{t('memoId')}</option>
            <option value="text">{t('memoText')}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t('exchangeMemo')}</label>
          <div className="flex gap-2">
            <input className="input font-mono text-sm" value={memoValue} onChange={(event) => onMemoChange(event.target.value)} spellCheck={false} placeholder={memoType === 'id' ? '123456789' : 'memo'} />
            <MotionButton variant="ghost" className="shrink-0" disabled={!validAddress || !validMemo || Boolean(activeAccount)} onClick={persistCurrent} title={t('saveThisAccount')}>
              <Bookmark className="h-4 w-4" /> {t('saveThisAccount')}
            </MotionButton>
          </div>
          <div className="mt-1 text-xs text-mute">{savedNotice ? t('accountSaved') : memoRequired ? t('destinationMemoRequired') : t('memoTypeHint')}</div>
        </div>
      </div>

      <AmountField symbol="USDC" label={t('amountUsdc')} value={amount} onChange={setAmount} balance={available} max={available} presets error={amountError} disabled={flow.busy} />

      <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
        <span className="text-sm text-mute">{t('youGetXlm')}</span>
        <span className="inline-flex items-center gap-2 text-xl tracking-tight text-ink">
          <TokenIcon symbol="XLM" size={20} />
          {xlm.quote ? `${formatAmount(xlm.quote.value, 2)} XLM` : '·'}
        </span>
      </div>
      <QuoteBar
        primary={xlm.quote && numeric > 0 ? `1 USDC = ${formatAmount(xlm.quote.value / numeric, 4)} XLM` : '·'}
        secondary={rate ? `≈ ₺${formatAmount(numeric * rate)}` : undefined}
        updatedAt={xlm.quote?.at ?? null}
        loading={xlm.loading}
        onRefresh={() => void xlm.fetch(numeric)}
        source={t('quoteDex')}
      />
      <Details
        title={t('details')}
        rows={[
          { label: t('minReceived'), value: minXlm !== null ? `${formatAmount(minXlm, 2)} XLM` : '·', icon: <TokenIcon symbol="XLM" size={14} /> },
          { label: t('slippage'), value: '1%' },
          { label: t('networkFee'), value: t('networkFeeValue') },
          { label: t('arrival'), value: t('arrivalDex') },
        ]}
      />

      <div className="rounded-2xl bg-soft p-4 text-sm">
        <div className="text-xs text-mute">{t('summaryTitle')}</div>
        <div className="mt-2 flex justify-between">
          <span className="text-mute">{t('summarySend')}</span>
          <span className="inline-flex items-center gap-2 text-ink">
            <TokenIcon symbol="USDC" size={16} /> {formatAmount(numeric)} USDC
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-mute">{t('summaryArrive')}</span>
          <span className="inline-flex items-center gap-2 text-ink">
            <TokenIcon symbol="XLM" size={16} /> {minXlm !== null ? `${t('minArrive')} ${formatAmount(minXlm, 2)} XLM` : '·'}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-4">
          <span className="text-mute">{t('summaryTo')}</span>
          <span className="inline-flex items-center gap-2 break-all text-right font-mono text-xs text-ink">
            <ExchangeLogo preset={preset} size={16} />
            {preset ? preset.name : t('exchangeOther')} · {shortAddress}
            {validMemo ? ` · memo ${memoType} ${memoValue.trim()}` : ''}
            {validAddress ? <CopyButton text={trimmed} /> : null}
          </span>
        </div>
      </div>

      <label className={'flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-4 py-3 text-sm ' + (verified ? '' : 'opacity-50')}>
        <input type="checkbox" className="mt-0.5 accent-accent-strong" checked={confirmed} disabled={!verified} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>{t('confirmDestination')}</span>
      </label>

      <MotionButton full className="py-3 text-base" disabled={!valid} onClick={() => void submit()}>
        <ArrowUpRight className="h-4 w-4" /> {t('sendToExchange')}
      </MotionButton>
      <Blocker reasons={reasons} />
      <Steps steps={flow.steps} />
      {receipt ? (
        <Receipt
          title={receipt.title}
          rows={receipt.rows}
          links={receipt.links}
          note={receipt.note}
          resetLabel={t('newTransaction')}
          onReset={() => {
            setReceipt(null)
            flow.reset()
          }}
        />
      ) : null}
      {flow.error ? <p className="break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function Usdt0Repay({ signer, wallet, line, health, refresh }: Shared) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const flow = useFlow()
  const balance = wallet?.usdt0 ?? null
  const debt = health?.debtUsdc ?? 0
  const numeric = Number(amount) || 0
  const quoteLoader = useCallback((value: number) => (usdt0Asset ? quoteStrictSend(usdt0Asset, value.toFixed(7), blendUsdcAsset) : Promise.resolve(null)), [])
  const usdc = useQuote(quoteLoader)
  const suggested = balance !== null && debt > 0 ? Math.min(balance, debt * 1.01) : 0

  useEffect(() => {
    if (balance !== null && amount === '' && suggested > 0) setAmount(suggested.toFixed(2))
  }, [balance, suggested, amount])

  useEffect(() => {
    const handle = setTimeout(() => void usdc.fetch(numeric), 400)
    return () => clearTimeout(handle)
  }, [numeric, usdc.fetch])

  const minUsdc = usdc.quote ? usdc.quote.value * 0.99 : null
  const amountError = numeric > 0 && balance !== null && numeric > balance ? t('reasonBalance') : null
  const reasons: string[] = []
  if (!signer) reasons.push(t('reasonWallet'))
  else if (!line) reasons.push(t('reasonLine'))
  if (debt <= 0) reasons.push(t('reasonDebt'))
  if (balance === null) reasons.push(t('reasonTrust'))
  if (numeric <= 0) reasons.push(t('reasonAmount'))
  if (numeric > 0 && !amountError && minUsdc === null) reasons.push(t('reasonQuote'))
  const valid = reasons.length === 0 && !amountError && !flow.busy

  const trust = () =>
    flow.run(['signing', 'done'], async (mark) => {
      if (!signer || !wallet) throw new Error(t('needWallet'))
      mark(0, 'active')
      const hash = await ensureTrustlines(signer, wallet, true)
      mark(0, 'done', hash ? txLink(hash) : undefined)
      mark(1, 'done')
      await refresh()
    })

  const submit = () =>
    flow.run(['converting', 'sending', 'done'], async (mark) => {
      if (!signer || !health) throw new Error(t('needWallet'))
      if (minUsdc === null) throw new Error(t('reasonQuote'))
      setReceipt(null)
      mark(0, 'active')
      const convertHash = await convertUsdt0ToUsdc(signer, numeric.toFixed(7), minUsdc.toFixed(7))
      mark(0, 'done', txLink(convertHash))
      mark(1, 'active')
      const repayUsdc = Math.min(minUsdc, health.debtUsdc * 1.001)
      const fullRepay = minUsdc >= health.debtUsdc
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(fullRepay ? (health.collateralXlm * 1.002).toFixed(7) : '0'))
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      const remaining = Math.max(0, health.debtUsdc - repayUsdc)
      const links = [{ label: t('view'), href: txLink(hash) }]
      const rows: ReceiptRow[] = [
        { label: 'USDT0', value: `${formatAmount(numeric)} USDT0` },
        { label: t('repaidUsdc'), value: `${formatAmount(repayUsdc)} USDC` },
        { label: t('remainingDebt'), value: `${formatAmount(remaining)} USDC` },
      ]
      if (fullRepay) rows.push({ label: t('collateralBack'), value: `${formatAmount(health.collateralXlm)} XLM` })
      setReceipt({ title: t('receiptUsdt0'), rows, links })
      addHistory(signer.address, { kind: 'usdt0', title: t('receiptUsdt0'), amount: `${formatAmount(repayUsdc)} USDC`, detail: `${formatAmount(numeric)} USDT0`, links })
      await refresh()
    })

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">{t('usdt0Body')}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 text-mute">
          <TokenIcon symbol="USDT0" size={20} />
          {t('usdt0Balance')}
        </span>
        <span className="text-ink">{balance === null ? '·' : `${formatAmount(balance)} USDT0`}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {balance === null && signer ? (
          <MotionButton variant="ghost" disabled={flow.busy} onClick={() => void trust()}>
            <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Trust')}
          </MotionButton>
        ) : null}
        <a className="btn-ghost" href={USDT0_TRANSFER_URL} target="_blank" rel="noreferrer">
          <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Bring')} <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      {balance !== null && balance <= 0 ? <p className="text-xs text-mute">{t('usdt0Missing')}</p> : null}
      <AmountField
        symbol="USDT0"
        label="USDT0"
        value={amount}
        onChange={setAmount}
        balance={balance ?? undefined}
        max={balance !== null ? Math.min(balance, Math.max(0, debt * 1.01)) : undefined}
        presets={balance !== null}
        error={amountError}
        disabled={flow.busy || balance === null}
        hint={`${t('debt')}: ${formatAmount(debt)} USDC`}
      />
      <QuoteBar
        primary={usdc.quote && numeric > 0 ? `1 USDT0 = ${formatAmount(usdc.quote.value / numeric, 4)} USDC` : '·'}
        secondary={minUsdc !== null ? `${t('minReceived')} ${formatAmount(minUsdc, 4)} USDC` : undefined}
        updatedAt={usdc.quote?.at ?? null}
        loading={usdc.loading}
        onRefresh={() => void usdc.fetch(numeric)}
        source={t('quoteDex')}
      />
      <Details
        title={t('details')}
        rows={[
          { label: t('slippage'), value: '1%' },
          { label: t('networkFee'), value: t('networkFeeValue'), icon: <TokenIcon symbol="XLM" size={14} /> },
          { label: t('arrival'), value: t('arrivalDex') },
        ]}
      />
      <MotionButton full className="py-3 text-base" disabled={!valid} onClick={() => void submit()}>
        <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Repay')}
      </MotionButton>
      <Blocker reasons={reasons} />
      <Steps steps={flow.steps} />
      {receipt ? (
        <Receipt
          title={receipt.title}
          rows={receipt.rows}
          links={receipt.links}
          resetLabel={t('newTransaction')}
          onReset={() => {
            setReceipt(null)
            flow.reset()
          }}
        />
      ) : null}
      {flow.error ? <p className="break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function UsdcRepay({ signer, wallet, line, health, refresh }: Shared) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [withdrawAll, setWithdrawAll] = useState(true)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const flow = useFlow()
  const balance = wallet?.blendUsdc ?? 0
  const debt = health?.debtUsdc ?? 0
  const numeric = Number(amount) || 0
  const maxRepay = Math.min(balance, debt * 1.001)

  useEffect(() => {
    if (amount === '' && maxRepay > 0) setAmount(maxRepay.toFixed(2))
  }, [maxRepay, amount])

  const amountError = wallet && numeric > 0 && numeric > balance ? t('reasonBalance') : null
  const reasons: string[] = []
  if (!signer) reasons.push(t('reasonWallet'))
  else if (!line) reasons.push(t('reasonLine'))
  if (debt <= 0) reasons.push(t('reasonDebt'))
  if (numeric <= 0) reasons.push(t('reasonAmount'))
  const valid = reasons.length === 0 && !amountError && !flow.busy
  const fullRepay = numeric >= debt

  const submit = () =>
    flow.run(['signing', 'sending', 'done'], async (mark) => {
      if (!signer || !health) throw new Error(t('needWallet'))
      setReceipt(null)
      mark(0, 'active')
      const repayUsdc = Math.min(numeric, health.debtUsdc * 1.001)
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(fullRepay && withdrawAll ? (health.collateralXlm * 1.002).toFixed(7) : '0'))
      mark(0, 'done')
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      const remaining = Math.max(0, health.debtUsdc - repayUsdc)
      const links = [{ label: t('view'), href: txLink(hash) }]
      const rows: ReceiptRow[] = [
        { label: t('repaidUsdc'), value: `${formatAmount(repayUsdc)} USDC` },
        { label: t('remainingDebt'), value: `${formatAmount(remaining)} USDC` },
      ]
      if (fullRepay && withdrawAll) rows.push({ label: t('collateralBack'), value: `${formatAmount(health.collateralXlm)} XLM` })
      setReceipt({ title: t('receiptUsdc'), rows, links })
      addHistory(signer.address, { kind: 'usdc', title: t('receiptUsdc'), amount: `${formatAmount(repayUsdc)} USDC`, links })
      await refresh()
    })

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">{t('usdcRepayBody')}</p>
      <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 text-mute">
          <TokenIcon symbol="USDC" size={20} /> {t('debt')}
        </span>
        <span className="text-ink">{formatAmount(debt)} USDC</span>
      </div>
      <AmountField
        symbol="USDC"
        label={t('amountUsdc')}
        value={amount}
        onChange={setAmount}
        balance={balance}
        max={maxRepay}
        presets
        error={amountError}
        disabled={flow.busy}
        extra={
          maxRepay > 0 ? (
            <button type="button" className="chip" onClick={() => setAmount(maxRepay.toFixed(2))}>
              {t('closeDebt')} · {formatAmount(maxRepay)} USDC
            </button>
          ) : null
        }
      />
      <div className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3 text-sm">
        <span className="text-mute">{t('remainingDebt')}</span>
        <span className="text-ink">{formatAmount(Math.max(0, debt - numeric))} USDC</span>
      </div>
      <label className={'flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm ' + (fullRepay ? '' : 'opacity-50')}>
        <input type="checkbox" checked={withdrawAll} disabled={!fullRepay} onChange={(event) => setWithdrawAll(event.target.checked)} className="accent-accent-strong" />
        {t('withdrawAllShort')}
      </label>
      <MotionButton full className="py-3 text-base" disabled={!valid} onClick={() => void submit()}>
        <Banknote className="h-4 w-4" /> {t('repayNow')}
      </MotionButton>
      <Blocker reasons={reasons} />
      <Steps steps={flow.steps} />
      {receipt ? (
        <Receipt
          title={receipt.title}
          rows={receipt.rows}
          links={receipt.links}
          resetLabel={t('newTransaction')}
          onReset={() => {
            setReceipt(null)
            flow.reset()
          }}
        />
      ) : null}
      {flow.error ? <p className="break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

export function MainnetExchange(shared: Shared) {
  const { t } = useT()
  const [mode, setMode] = useState<Mode>('exchange')
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <TokenIcon symbol="TRY" size={22} />
          {t('exchange')}
        </h3>
        <span className="pill">Mainnet</span>
      </div>
      <div className="mt-4">
        <ModeSwitch
          name="mainnet-exchange"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'exchange', label: t('modeExchange'), icon: <Building2 className="h-4 w-4" /> },
            { id: 'usdt0', label: t('modeUsdt0'), icon: <TokenIcon symbol="USDT0" size={16} /> },
            { id: 'usdc', label: t('modeUsdc'), icon: <TokenIcon symbol="USDC" size={16} /> },
          ]}
        />
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-soft px-4 py-2.5 text-xs text-mute">{t('mainnetWarning')}</div>
      <div className="mt-4">
        {mode === 'exchange' ? <ExchangeCashOut {...shared} /> : null}
        {mode === 'usdt0' ? <Usdt0Repay {...shared} /> : null}
        {mode === 'usdc' ? <UsdcRepay {...shared} /> : null}
      </div>
    </div>
  )
}
