import { useEffect, useState } from 'react'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { Memo } from '@stellar/stellar-sdk'
import { USDT0_TRANSFER_URL } from '../config'
import { convertUsdt0ToUsdc, ensureTrustlines, formatAmount, quoteStrictSend, repayLine, sendToExchange, toStroops, blendUsdcAsset, usdt0Asset } from '../lib/chain'
import { Asset } from '@stellar/stellar-sdk'
import { useT } from '../lib/i18n'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { Steps } from './Steps'
import { TokenIcon } from './TokenIcon'

function ExchangeCashOut({ signer, wallet, line, rate, refresh }: Shared) {
  const { t } = useT()
  const [destination, setDestination] = useState('')
  const [memoType, setMemoType] = useState<'id' | 'text'>('id')
  const [memoValue, setMemoValue] = useState('')
  const [amount, setAmount] = useState('10')
  const [xlmQuote, setXlmQuote] = useState<number | null>(null)
  const flow = useFlow()
  const numeric = Number(amount.replace(',', '.')) || 0
  const available = wallet?.blendUsdc ?? 0

  useEffect(() => {
    if (numeric <= 0) return
    const handle = setTimeout(() => {
      quoteStrictSend(blendUsdcAsset, numeric.toFixed(7), Asset.native())
        .then(setXlmQuote)
        .catch(() => setXlmQuote(null))
    }, 400)
    return () => clearTimeout(handle)
  }, [numeric])

  const validAddress = /^G[A-Z2-7]{55}$/.test(destination.trim())
  const validMemo = memoType === 'id' ? /^\d+$/.test(memoValue.trim()) : memoValue.trim().length > 0 && memoValue.trim().length <= 28
  const valid = Boolean(signer && line) && numeric > 0 && numeric <= available && validAddress && validMemo && xlmQuote !== null

  const submit = () =>
    flow.run(['signing', 'sending', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      if (xlmQuote === null) throw new Error('quote missing')
      mark(0, 'active')
      const memo = memoType === 'id' ? Memo.id(memoValue.trim()) : Memo.text(memoValue.trim())
      const hash = await sendToExchange(signer, numeric.toFixed(7), destination.trim(), memo, (xlmQuote * 0.99).toFixed(7))
      mark(0, 'done')
      mark(1, 'done', txLink(hash))
      mark(2, 'done')
      await refresh()
    })

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
      <div className="mt-4 grid gap-3">
        <div>
          <label className="label">{t('exchangeAddress')}</label>
          <input className="input font-mono text-sm" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="G…" />
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
            <input className="input font-mono text-sm" value={memoValue} onChange={(e) => setMemoValue(e.target.value)} />
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
      <MotionButton full className="mt-4 py-3" disabled={!valid || flow.busy} onClick={() => void submit()}>
        <ArrowUpRight className="h-4 w-4" /> {t('sendToExchange')}
      </MotionButton>
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
          <RefreshCw className="h-5 w-5" />
          {t('usdt0Title')}
        </h3>
        <span className="pill">LayerZero · USDT0</span>
      </div>
      <p className="mt-1 text-sm text-mute">{t('usdt0Body')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="text-mute">{t('usdt0Balance')}</span>
        <span className="text-ink">{balance === null ? '·' : `${formatAmount(balance)} USDT0`}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {balance === null && signer ? (
          <MotionButton variant="ghost" disabled={flow.busy} onClick={() => void trust()}>
            {t('usdt0Trust')}
          </MotionButton>
        ) : null}
        <a className="btn-ghost" href={USDT0_TRANSFER_URL} target="_blank" rel="noreferrer">
          {t('usdt0Bring')} <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">USDT0</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="mt-1 text-xs text-mute">
            {t('debt')}: {formatAmount(debt)} USDC
          </div>
        </div>
        <div>
          <label className="label">{t('minReceive')}</label>
          <div className="input bg-soft">{quote !== null ? `${formatAmount(quote * 0.99, 4)} USDC` : '·'}</div>
        </div>
      </div>
      <MotionButton full className="mt-4 py-3" disabled={!valid || flow.busy} onClick={() => void submit()}>
        {t('usdt0Repay')}
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
