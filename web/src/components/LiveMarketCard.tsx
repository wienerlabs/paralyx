import { formatAmount } from '../lib/chain'
import type { PoolOverview } from '../lib/blend'
import { useT } from '../lib/i18n'
import type { LivePrices } from '../lib/prices'
import { TokenIcon } from './TokenIcon'
import { PoolStatusBadge } from './PoolStatusBadge'

function usd(value: number): string {
  return value >= 1_000_000 ? `$${formatAmount(value / 1_000_000)}M` : `$${formatAmount(value, 0)}`
}

export function LiveMarketCard({ live, overview }: { live: LivePrices; overview: PoolOverview | null }) {
  const { t } = useT()
  const rows = [
    { symbol: 'TRY' as const, label: t('usdTry'), value: live.tryPerUsd ? `₺${formatAmount(live.tryPerUsd)}` : '·' },
    { symbol: 'XLM' as const, label: t('xlmUsd'), value: live.xlmUsd ? `$${formatAmount(live.xlmUsd, 4)}` : '·' },
    { symbol: 'USDC' as const, label: t('poolTvl'), value: overview ? usd(overview.totalSuppliedUsd) : '·' },
  ]
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span className="live-dot" />
          {t('liveTitle')}
        </div>
        <span className="text-xs text-mute">{live.updatedAt ? new Date(live.updatedAt).toLocaleTimeString('tr-TR') : ''}</span>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
            <span className="inline-flex items-center gap-3 text-sm text-mute">
              <TokenIcon symbol={row.symbol} size={26} />
              {row.label}
            </span>
            <span className="text-xl tracking-tight text-ink">{row.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
          <span className="text-sm text-mute">{t('linesTotal')}</span>
          <span className="text-xl tracking-tight text-ink">{overview ? overview.lineCount : '·'}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
          <span className="text-sm text-mute">{t('poolStatusLabel')}</span>
          <PoolStatusBadge status={overview?.status ?? null} />
        </div>
      </div>
      <p className="mt-4 text-xs text-mute">Reflector FX · Stellar DEX · Blend v2</p>
    </div>
  )
}
