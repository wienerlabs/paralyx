import { poolStatusKey } from '../lib/blend'
import { useT } from '../lib/i18n'

export function PoolStatusBadge({ status, className = '' }: { status: number | null; className?: string }) {
  const { t } = useT()
  if (status === null) return null
  const key = poolStatusKey(status)
  const tone = key === 'poolStatusActive' ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-ink'
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${tone} ${className}`}>{t(key)}</span>
}
