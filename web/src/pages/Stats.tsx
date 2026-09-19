import { useEffect, useState } from 'react'
import { CREDIT_LINE_CONTRACT, EXPLORER_CONTRACT } from '../config'
import { formatAmount, fromStroops, getActivity, getLineCount, type ActivityEvent } from '../lib/chain'
import { useT } from '../lib/i18n'
import { ActivityList } from './Home'

export function Stats() {
  const { t } = useT()
  const [count, setCount] = useState<number | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [total, activity] = await Promise.all([getLineCount().catch(() => null), getActivity().catch(() => [])])
      if (cancelled) return
      setCount(total)
      setEvents(activity)
    }
    void load()
    const timer = setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const opened = events.filter((event) => event.kind === 'opened')
  const payouts = events.filter((event) => event.kind === 'payout')
  const xlm = opened.reduce((sum, event) => sum + event.a, 0n)
  const usdc = opened.reduce((sum, event) => sum + event.b, 0n)
  const tryPaid = payouts.reduce((sum, event) => sum + event.a, 0n)

  const cards = [
    { label: t('linesOpened'), value: count === null ? '·' : String(count) },
    { label: t('xlmLocked'), value: `${fromStroops(xlm, 0)} XLM` },
    { label: t('usdcBorrowed'), value: `${fromStroops(usdc)} USDC` },
    { label: t('tryPaid'), value: `₺${formatAmount(Number(tryPaid) / 100)}` },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20">
      <section className="py-10">
        <span className="pill">{t('testnet')}</span>
        <h1 className="mt-4 text-4xl tracking-tight text-ink sm:text-5xl">{t('statsTitle')}</h1>
        <p className="mt-2 text-sm text-mute">
          {t('contract')}:{' '}
          <a className="underline" href={`${EXPLORER_CONTRACT}${CREDIT_LINE_CONTRACT}`} target="_blank" rel="noreferrer">
            {CREDIT_LINE_CONTRACT}
          </a>
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className="text-xs text-mute">{card.label}</div>
            <div className="mt-2 text-3xl tracking-tight text-ink">{card.value}</div>
          </div>
        ))}
      </section>
      <section className="mt-6">
        <ActivityList events={events} title={t('activity')} />
      </section>
    </main>
  )
}
