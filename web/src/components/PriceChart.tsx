import { useMemo, type ReactNode } from 'react'

export interface Point {
  t: number
  v: number
}

const W = 320
const H = 120
const P = 8

export function PriceChart({
  title,
  subtitle,
  points,
  format,
  icon,
  footer,
}: {
  title: string
  subtitle: string
  points: Point[]
  format: (value: number) => string
  icon?: ReactNode
  footer?: string
}) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null
    const values = points.map((p) => p.v)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || max * 0.02 || 1
    const lo = min - span * 0.15
    const hi = max + span * 0.15
    const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P)
    const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P)
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - P} L${x(0).toFixed(1)} ${H - P} Z`
    const last = points[points.length - 1]
    return { line, area, min, max, lastX: x(points.length - 1), lastY: y(last.v), last: last.v, first: points[0].v }
  }, [points])

  const change = geometry ? ((geometry.last - geometry.first) / geometry.first) * 100 : null

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <div className="text-sm text-ink">{title}</div>
            <div className="text-xs text-mute">{subtitle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg text-ink">{geometry ? format(geometry.last) : '·'}</div>
          {change !== null ? (
            <div className="text-xs text-mute">
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        {geometry ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label={title}>
            <path d={geometry.area} fill="#f3f3f3" />
            <path d={geometry.line} fill="none" stroke="#111111" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={geometry.lastX} cy={geometry.lastY} r="3.2" fill="#111111" />
            <circle cx={geometry.lastX} cy={geometry.lastY} r="7" fill="#111111" opacity="0.12" />
          </svg>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-2xl bg-soft text-xs text-mute">·</div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-mute">
        <span>{geometry ? format(geometry.min) : ''}</span>
        <span>{footer ?? ''}</span>
        <span>{geometry ? format(geometry.max) : ''}</span>
      </div>
    </div>
  )
}
