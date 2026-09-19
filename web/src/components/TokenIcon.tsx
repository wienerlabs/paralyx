export type TokenSymbol = 'USDC' | 'XLM' | 'TRY'

const sources: Record<TokenSymbol, string> = {
  USDC: '/tokens/usdc.svg',
  XLM: '/tokens/xlm.svg',
  TRY: '/tokens/tr.svg',
}

export const tokenNames: Record<TokenSymbol, string> = {
  USDC: 'USD Coin',
  XLM: 'Stellar Lumens',
  TRY: 'Türk lirası',
}

export function TokenIcon({ symbol, size = 24, className = '' }: { symbol: TokenSymbol; size?: number; className?: string }) {
  return (
    <span
      className={'inline-flex shrink-0 overflow-hidden rounded-full border border-line bg-white ' + className}
      style={{ width: size, height: size }}
    >
      <img
        src={sources[symbol]}
        alt={symbol}
        draggable={false}
        className="h-full w-full object-cover"
        style={symbol === 'TRY' ? { objectPosition: '38% 50%' } : undefined}
      />
    </span>
  )
}

export function TokenLabel({ symbol, size = 20, className = '' }: { symbol: TokenSymbol; size?: number; className?: string }) {
  return (
    <span className={'inline-flex items-center gap-2 ' + className}>
      <TokenIcon symbol={symbol} size={size} />
      <span>{symbol === 'TRY' ? '₺ TRY' : symbol}</span>
    </span>
  )
}
