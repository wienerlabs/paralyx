import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Building2, ShieldCheck } from 'lucide-react'
import { lookupDirectory, type DirectoryEntry } from '../lib/directory'
import { Memo } from '@stellar/stellar-sdk'
import { USDT0_TRANSFER_URL } from '../config'
import { checkDestination, convertUsdt0ToUsdc, ensureTrustlines, formatAmount, quoteStrictSend, repayLine, sendToExchange, toStroops, blendUsdcAsset, usdt0Asset, type DestinationCheck } from '../lib/chain'
import { Asset } from '@stellar/stellar-sdk'
import { useT } from '../lib/i18n'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { Steps } from './Steps'
import { TokenIcon } from './TokenIcon'

interface ExchangePreset {
  id: string
  name: string
  match: string
  logo: string
  url: string
  deposit?: string
}

const exchanges: ExchangePreset[] = [
  { id: 'paribu', name: 'Paribu', match: 'paribu', logo: '/exchanges/paribu.png', url: 'https://www.paribu.com', deposit: 'GBZLHGDYMSVF4X6DYAGKLIQX3F64W3MXNDVGHKQPR226TCJ5QJ2ZQKVA' },
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

function ExchangeCashOut({ signer, wallet, rate, refresh }: Shared) {
  const { t } = useT()
  const [exchangeId, setExchangeId] = useState<string>('paribu')
  const [destination, setDestination] = useState<string>(exchanges[0].deposit ?? '')
  const [memoType, setMemoType] = useState<'id' | 'text'>('id')
  const [memoValue, setMemoValue] = useState('')
  const [amount, setAmount] = useState('10')
  const [xlmQuote, setXlmQuote] = useState<number | null>(null)
  const [check, setCheck] = useState<DestinationState | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const flow = useFlow()
  const preset = exchanges.find((entry) => entry.id === exchangeId) ?? null
  const numeric = Number(amount.replace(',', '.')) || 0
  const available = wallet?.blendUsdc ?? 0
  const trimmed = destination.trim()
  const validAddress = /^G[A-Z2-7]{55}$/.test(trimmed)
  const isSelf = signer ? trimmed === signer.address : false
  const current = check && check.address === trimmed ? check : null
  const exists = current?.horizon.exists ?? false
  const directory = current?.directory
  const mismatch = Boolean(preset && directory && directory.domain && !directory.domain.toLowerCase().includes(preset.match))
  const verified = exists && !isSelf && !mismatch
  const memoRequired = exists && ((current?.horizon.memoRequired ?? false) || (directory?.tags.includes('memo-required') ?? false))
  const memoBytes = new TextEncoder().encode(memoValue.trim()).length
  const validMemo = memoType === 'id' ? /^\d+$/.test(memoValue.trim()) : memoValue.trim().length > 0 && memoBytes <= 28
  const minXlm = xlmQuote !== null ? xlmQuote * 0.99 : null
  const valid = Boolean(signer) && numeric > 0 && numeric <= available && validAddress && verified && validMemo && minXlm !== null && confirmed
  const presetFilled = Boolean(preset?.deposit && trimmed === preset.deposit)

  useEffect(() => {
    if (numeric <= 0) return
    const handle = setTimeout(() => {
      quoteStrictSend(blendUsdcAsset, numeric.toFixed(7), Asset.native())
        .then(setXlmQuote)
        .catch(() => setXlmQuote(null))
    }, 400)
    return () => clearTimeout(handle)
  }, [numeric])

  useEffect(() => {
    setConfirmed(false)
  }, [trimmed, exchangeId])

  const verify = async (address: string) => {
    if (!/^G[A-Z2-7]{55}$/.test(address)) return
    setChecking(true)
    try {
      const [horizon, dir] = await Promise.all([checkDestination(address), lookupDirectory(address).catch(() => undefined)])
      setCheck({ address, horizon, directory: dir })
    } finally {
      setChecking(false)
    }
  }

  const choose = (entry: ExchangePreset | null) => {
    setExchangeId(entry?.id ?? 'other')
    if (entry?.deposit) {
      setDestination(entry.deposit)
      void verify(entry.deposit)
    } else if (preset?.deposit && trimmed === preset.deposit) {
      setDestination('')
      setCheck(null)
    }
  }

  const submit = () =>
    flow.run(['verifying', 'signing', 'sending', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (minXlm === null) throw new Error('quote missing')
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
          : `${t('destinationOk')} · ${directory ? `${t('directoryListed')}: ${directory.name}${directory.domain ? ` (${directory.domain})` : ''}${directory.tags.length ? ` · ${directory.tags.join(', ')}` : ''}` : t('directoryNotListed')}`
      : ''

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <TokenIcon symbol="TRY" size={22} />
          {t('exchangeCashTitle')}
        </h3>
        <span className="pill">Mainnet</span>
      </div>
      <p className="mt-1 text-sm text-mute">{t('exchangeCashBody')}</p>

      <div className="mt-4">
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
                (exchangeId === entry.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink')
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
              (exchangeId === 'other' ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink')
            }
          >
            <Building2 className="h-4 w-4" /> {t('exchangeOther')}
          </motion.button>
        </div>
        {preset ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
            <a className="inline-flex items-center gap-1 underline" href={preset.url} target="_blank" rel="noreferrer">
              <ExchangeLogo preset={preset} size={14} /> {t('openExchange')} <ArrowUpRight className="h-3 w-3" />
            </a>
            <span>{t('memoFromExchange')}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <label className="label">{t('exchangeAddress')}</label>
          <div className="flex gap-2">
            <input className="input font-mono text-sm" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="G…" spellCheck={false} />
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
            <select className="input" value={memoType} onChange={(e) => setMemoType(e.target.value as 'id' | 'text')}>
              <option value="id">{t('memoId')}</option>
              <option value="text">{t('memoText')}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t('exchangeMemo')}</label>
            <input className="input font-mono text-sm" value={memoValue} onChange={(e) => setMemoValue(e.target.value)} spellCheck={false} />
            <div className="mt-1 text-xs text-mute">{memoRequired ? t('destinationMemoRequired') : t('memoTypeHint')}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label flex items-center gap-2">
              <TokenIcon symbol="USDC" size={16} /> {t('amountUsdc')}
            </label>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-1 text-xs text-mute">
              {t('available')}: {formatAmount(available)} USDC
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <TokenIcon symbol="XLM" size={16} /> {t('youGetXlm')}
            </label>
            <div className="input bg-soft">{xlmQuote !== null ? `${formatAmount(xlmQuote, 2)} XLM` : '·'}</div>
            <div className="mt-1 text-xs text-mute">{rate ? `≈ ₺${formatAmount(numeric * rate)}` : ''}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-soft p-4 text-sm">
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
          </span>
        </div>
      </div>

      <label className={'mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-4 py-3 text-sm ' + (verified ? '' : 'opacity-50')}>
        <input type="checkbox" className="mt-0.5 accent-black" checked={confirmed} disabled={!verified} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{t('confirmDestination')}</span>
      </label>

      <MotionButton full className="mt-4 py-3" disabled={!valid || flow.busy} onClick={() => void submit()}>
        <ArrowUpRight className="h-4 w-4" /> {t('sendToExchange')}
      </MotionButton>
      {memoRequired && !validMemo ? <p className="mt-2 text-xs text-ink">{t('destinationMemoRequired')}</p> : null}
      <p className="mt-2 text-xs text-mute">{t('exchangeSteps')}</p>
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function Usdt0Repay({ signer, wallet, line, health, refresh }: Shared) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<number | null>(null)
  const flow = useFlow()
  const balance = wallet?.usdt0 ?? null
  const debt = health?.debtUsdc ?? 0
  const numeric = Number(amount.replace(',', '.')) || 0

  useEffect(() => {
    if (balance !== null && amount === '' && debt > 0) setAmount(Math.min(balance, debt * 1.01).toFixed(2))
  }, [balance, debt, amount])

  useEffect(() => {
    const asset = usdt0Asset
    if (numeric <= 0 || !asset) return
    const handle = setTimeout(() => {
      quoteStrictSend(asset, numeric.toFixed(7), blendUsdcAsset)
        .then(setQuote)
        .catch(() => setQuote(null))
    }, 400)
    return () => clearTimeout(handle)
  }, [numeric])

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
      if (!line) throw new Error(t('needLine'))
      if (quote === null) throw new Error('quote missing')
      mark(0, 'active')
      const minUsdc = quote * 0.99
      const convertHash = await convertUsdt0ToUsdc(signer, numeric.toFixed(7), minUsdc.toFixed(7))
      mark(0, 'done', txLink(convertHash))
      mark(1, 'active')
      const repayUsdc = Math.min(minUsdc, health.debtUsdc * 1.001)
      const fullRepay = minUsdc >= health.debtUsdc
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(fullRepay ? (health.collateralXlm * 1.002).toFixed(7) : '0'))
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      await refresh()
    })

  const valid = Boolean(signer && line) && balance !== null && numeric > 0 && numeric <= balance && quote !== null && debt > 0

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <TokenIcon symbol="USDT0" size={22} />
          {t('usdt0Title')}
        </h3>
        <span className="pill">
          <TokenIcon symbol="USDT0" size={14} className="mr-1.5" /> LayerZero · USDT0
        </span>
      </div>
      <p className="mt-1 text-sm text-mute">{t('usdt0Body')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 text-mute">
          <TokenIcon symbol="USDT0" size={20} />
          {t('usdt0Balance')}
        </span>
        <span className="text-ink">{balance === null ? '·' : `${formatAmount(balance)} USDT0`}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {balance === null && signer ? (
          <MotionButton variant="ghost" disabled={flow.busy} onClick={() => void trust()}>
            <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Trust')}
          </MotionButton>
        ) : null}
        <a className="btn-ghost" href={USDT0_TRANSFER_URL} target="_blank" rel="noreferrer">
          <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Bring')} <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label flex items-center gap-2">
            <TokenIcon symbol="USDT0" size={16} /> USDT0
          </label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {t('debt')}: {formatAmount(debt)} USDC
          </div>
        </div>
        <div>
          <label className="label flex items-center gap-2">
            <TokenIcon symbol="USDC" size={16} /> {t('minReceive')}
          </label>
          <div className="input bg-soft">{quote !== null ? `${formatAmount(quote * 0.99, 4)} USDC` : '·'}</div>
        </div>
      </div>
      <MotionButton full className="mt-4 py-3" disabled={!valid || flow.busy} onClick={() => void submit()}>
        <TokenIcon symbol="USDT0" size={18} /> {t('usdt0Repay')}
      </MotionButton>
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

function UsdcRepay({ signer, wallet, line, health, refresh }: Shared) {
  const { t } = useT()
  const flow = useFlow()
  const balance = wallet?.blendUsdc ?? 0
  const debt = health?.debtUsdc ?? 0
  const repayUsdc = Math.min(balance, debt * 1.001)
  const valid = Boolean(signer && line) && debt > 0 && balance > 0
  const submit = () =>
    flow.run(['signing', 'sending', 'done'], async (mark) => {
      if (!signer || !health) throw new Error(t('needWallet'))
      mark(0, 'active')
      const fullRepay = balance >= debt
      const hash = await repayLine(signer, toStroops(repayUsdc.toFixed(7)), toStroops(fullRepay ? (health.collateralXlm * 1.002).toFixed(7) : '0'))
      mark(0, 'done')
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      await refresh()
    })
  return (
    <div className="card">
      <h3 className="flex items-center gap-2 text-lg text-ink">
        <TokenIcon symbol="USDC" size={22} />
        {t('usdcRepayTitle')}
      </h3>
      <p className="mt-1 text-sm text-mute">{t('usdcRepayBody')}</p>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="text-mute">{t('debt')}</span>
        <span className="text-ink">{formatAmount(debt)} USDC</span>
      </div>
      <MotionButton full className="mt-4 py-3" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('repayNow')} · {formatAmount(repayUsdc)} USDC
      </MotionButton>
      <Steps steps={flow.steps} />
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}

export function MainnetExchange(shared: Shared) {
  const { t } = useT()
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-xs text-mute">{t('mainnetWarning')}</div>
      <ExchangeCashOut {...shared} />
      <Usdt0Repay {...shared} />
      <UsdcRepay {...shared} />
    </div>
  )
}
