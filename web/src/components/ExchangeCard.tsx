import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Banknote } from 'lucide-react'
import { ANCHOR_HOME_DOMAIN, ANCHOR_MAX_TRY, ANCHOR_MAX_USDC } from '../config'
import { authenticate, quoteTryToUsdc, quoteUsdcToTry, simulateBankTransfer, startDeposit, startWithdraw, waitForStatus, type Quote } from '../lib/anchor'
import { convertCircleToBlendUsdc, formatAmount, payAnchorWithBlendUsdc, recordPayout, repayLine, toStroops } from '../lib/chain'
import { addHistory } from '../lib/history'
import { useT } from '../lib/i18n'
import { txLink, useFlow, type Shared } from '../lib/shared'
import { MotionButton } from './MotionButton'
import { Steps } from './Steps'
import { TokenIcon } from './TokenIcon'
import { AmountField, Blocker, Details, ModeSwitch, QuoteBar, Receipt, type ReceiptRow } from './exchange/primitives'

type Mode = 'cashout' | 'repay'

interface ReceiptData {
  title: string
  rows: ReceiptRow[]
  links: { label: string; href: string }[]
}

const MIN_USDC = 0.5
const MIN_TRY = 50

export function ExchangeCard({ signer, wallet, line, health, rate, refresh }: Shared) {
  const { t } = useT()
  const [mode, setMode] = useState<Mode>('cashout')
  const [amount, setAmount] = useState('10')
  const [quote, setQuote] = useState<{ value: Quote; at: number } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [withdrawAll, setWithdrawAll] = useState(true)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const flow = useFlow()
  const requestId = useRef(0)
  const cashOut = mode === 'cashout'
  const numeric = Number(amount) || 0
  const available = wallet?.blendUsdc ?? 0
  const debt = health?.debtUsdc ?? 0
  const maxCashOut = Math.max(0, Math.min(available, ANCHOR_MAX_USDC))
  const suggestedRepay = rate && debt > 0 ? Math.min(ANCHOR_MAX_TRY, Math.ceil(debt * 1.01 * rate)) : 0

  const fetchQuote = useCallback(async (value: number, direction: Mode) => {
    if (value <= 0) {
      setQuote(null)
      return
    }
    requestId.current += 1
    const id = requestId.current
    setQuoting(true)
    try {
      const result = direction === 'cashout' ? await quoteUsdcToTry(value) : await quoteTryToUsdc(value)
      if (id === requestId.current) setQuote({ value: result, at: Date.now() })
    } catch {
      if (id === requestId.current) setQuote(null)
    } finally {
      if (id === requestId.current) setQuoting(false)
    }
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => void fetchQuote(numeric, mode), 350)
    return () => clearTimeout(handle)
  }, [numeric, mode, fetchQuote])

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setReceipt(null)
    setQuote(null)
    flow.reset()
    setAmount(next === 'cashout' ? (maxCashOut > 0 ? String(Math.min(10, Math.floor(maxCashOut * 100) / 100)) : '10') : suggestedRepay > 0 ? String(suggestedRepay) : '')
  }

  const amountError = useMemo(() => {
    if (!amount || numeric <= 0) return null
    if (cashOut) {
      if (numeric < MIN_USDC || numeric > ANCHOR_MAX_USDC) return t('amountRange').replace('{min}', `${MIN_USDC} USDC`).replace('{max}', `${ANCHOR_MAX_USDC} USDC`)
      if (wallet && numeric > available) return t('reasonBalance')
      return null
    }
    if (numeric < MIN_TRY || numeric > ANCHOR_MAX_TRY) return t('amountRange').replace('{min}', `₺${MIN_TRY}`).replace('{max}', `₺${ANCHOR_MAX_TRY}`)
    return null
  }, [amount, numeric, cashOut, available, wallet, t])

  const reasons: string[] = []
  if (!signer) reasons.push(t('reasonWallet'))
  else if (!line) reasons.push(t('reasonLine'))
  if (!cashOut && debt <= 0) reasons.push(t('reasonDebt'))
  if (numeric <= 0) reasons.push(t('reasonAmount'))
  if (numeric > 0 && !amountError && !quote) reasons.push(t('reasonQuote'))
  const valid = reasons.length === 0 && !amountError && !flow.busy

  const runCashOut = () =>
    flow.run(['anchorAuth', 'anchorQuote', 'anchorWithdraw', 'paying', 'anchorWait', 'recording', 'done'], async (mark) => {
      if (!signer) throw new Error(t('needWallet'))
      setReceipt(null)
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
      mark(4, 'done', `₺${formatAmount(tryPaid)}`)
      mark(5, 'active')
      const recordHash = await recordPayout(signer, instruction.id, BigInt(Math.round(tryPaid * 100)))
      mark(5, 'done', txLink(recordHash))
      mark(6, 'done')
      const links = [{ label: t('view'), href: txLink(hash) }, ...(settled.moreInfoUrl ? [{ label: t('anchorTx'), href: settled.moreInfoUrl }] : [])]
      const rows: ReceiptRow[] = [
        { label: t('sentUsdc'), value: `${formatAmount(numeric)} USDC` },
        { label: t('paidTry'), value: `₺${formatAmount(tryPaid)}` },
      ]
      if (settled.externalTransactionId) rows.push({ label: t('reference'), value: settled.externalTransactionId, copy: settled.externalTransactionId })
      setReceipt({ title: t('receiptCashOut'), rows, links })
      addHistory(signer.address, { kind: 'cashout', title: t('receiptCashOut'), amount: `₺${formatAmount(tryPaid)}`, detail: settled.externalTransactionId, links })
      await refresh()
    })

  const runRepay = () =>
    flow.run(['anchorAuth', 'anchorDeposit', 'anchorBank', 'anchorWait', 'converting', 'sending', 'done'], async (mark) => {
      if (!signer || !health) throw new Error(t('needWallet'))
      setReceipt(null)
      mark(0, 'active')
      const token = await authenticate(signer)
      mark(0, 'done')
      mark(1, 'active')
      const fresh = await quoteTryToUsdc(numeric)
      const deposit = await startDeposit(token, signer.address, numeric)
      mark(1, 'done', deposit.reference ? `${t('iban')} ${deposit.iban ?? ''} · ${t('reference')} ${deposit.reference}` : deposit.id)
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
      const remaining = Math.max(0, health.debtUsdc - repayUsdc)
      const links = [{ label: t('view'), href: txLink(hash) }, ...(deposit.moreInfoUrl ? [{ label: t('anchorTx'), href: deposit.moreInfoUrl }] : [])]
      const rows: ReceiptRow[] = [
        { label: t('amountTry'), value: `₺${formatAmount(numeric)}` },
        { label: t('receivedUsdc'), value: `${formatAmount(received)} USDC` },
        { label: t('repaidUsdc'), value: `${formatAmount(repayUsdc)} USDC` },
        { label: t('remainingDebt'), value: `${formatAmount(remaining)} USDC` },
      ]
      if (fullRepay && withdrawAll) rows.push({ label: t('collateralBack'), value: `${formatAmount(health.collateralXlm)} XLM` })
      setReceipt({ title: t('receiptRepay'), rows, links })
      addHistory(signer.address, { kind: 'repay', title: t('receiptRepay'), amount: `${formatAmount(repayUsdc)} USDC`, detail: `₺${formatAmount(numeric)}`, links })
      await refresh()
    })

  const total = quote ? quote.value.buyAmount : rate ? (cashOut ? numeric * rate : numeric / rate) : 0
  const fee = quote ? quote.value.feeTotal : numeric * 0.005
  const rateLine = rate ? (cashOut ? `1 USDC = ₺${formatAmount(rate)}` : `₺1 = ${formatAmount(1 / rate, 4)} USDC`) : '·'

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <TokenIcon symbol="TRY" size={22} />
          {t('exchange')}
        </h3>
        <span className="pill">SEP-6 · {ANCHOR_HOME_DOMAIN}</span>
      </div>
      <div className="mt-4">
        <ModeSwitch
          name="testnet-exchange"
          value={mode}
          onChange={switchMode}
          disabled={flow.busy}
          options={[
            { id: 'cashout', label: t('modeCashOut'), icon: <ArrowDownToLine className="h-4 w-4" /> },
            { id: 'repay', label: t('modeRepay'), icon: <Banknote className="h-4 w-4" /> },
          ]}
        />
      </div>
      <p className="mt-3 text-sm text-mute">{cashOut ? t('cashOutHint') : t('repayHint')}</p>

      <div className="mt-4 space-y-3">
        {cashOut ? (
          <AmountField symbol="USDC" label={t('amountUsdc')} value={amount} onChange={setAmount} balance={available} max={maxCashOut} presets error={amountError} disabled={flow.busy} autoFocus />
        ) : (
          <AmountField
            symbol="TRY"
            label={t('amountTry')}
            value={amount}
            onChange={setAmount}
            error={amountError}
            disabled={flow.busy}
            hint={debt > 0 ? `${t('debt')}: ${formatAmount(debt)} USDC${rate ? ` ≈ ₺${formatAmount(debt * rate)}` : ''}` : t('noDebtHint')}
            extra={
              suggestedRepay > 0 ? (
                <button type="button" className="chip" onClick={() => setAmount(String(suggestedRepay))}>
                  {t('closeDebt')} · ₺{formatAmount(suggestedRepay, 0)}
                </button>
              ) : null
            }
          />
        )}
        <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
          <span className="text-sm text-mute">{t('youGet')}</span>
          <span className="inline-flex items-center gap-2 text-xl tracking-tight text-ink">
            <TokenIcon symbol={cashOut ? 'TRY' : 'USDC'} size={20} />
            {cashOut ? `₺${formatAmount(total)}` : `${formatAmount(total, 4)} USDC`}
          </span>
        </div>
        <QuoteBar primary={rateLine} secondary={t('quoteHint')} updatedAt={quote?.at ?? null} loading={quoting} onRefresh={() => void fetchQuote(numeric, mode)} source={t('quoteAnchor')} />
        <Details
          title={t('details')}
          rows={[
            { label: t('feeAnchorPct'), value: cashOut ? `${formatAmount(fee, 4)} USDC` : `₺${formatAmount(fee)}` },
            { label: t('networkFee'), value: t('networkFeeValue'), icon: <TokenIcon symbol="XLM" size={14} /> },
            { label: t('seamDex'), value: t('seamDexValue') },
            { label: t('arrival'), value: t('arrivalSandbox') },
          ]}
        />
        {!cashOut ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
            <input type="checkbox" checked={withdrawAll} onChange={(event) => setWithdrawAll(event.target.checked)} className="accent-accent-strong" />
            {t('withdrawAllShort')}
          </label>
        ) : null}
      </div>

      <MotionButton full className="mt-4 py-3 text-base" disabled={!valid} onClick={() => void (cashOut ? runCashOut() : runRepay())}>
        {cashOut ? t('cashOutAction') : t('repayAction')}
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
      {flow.error ? <p className="mt-3 break-all text-sm text-ink">{flow.error}</p> : null}
    </div>
  )
}
