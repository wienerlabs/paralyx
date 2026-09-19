export type TokenSymbol = 'USDC' | 'USDT0' | 'XLM' | 'TRY' | 'ETH' | 'BTC'

const sources: Record<TokenSymbol, string> = {
  USDC: '/tokens/usdc.svg',
  USDT0: '/tokens/usdt0.png',
  XLM: '/tokens/xlm.svg',
  TRY: '/tokens/tr.svg',
  ETH: '/tokens/eth.svg',
  BTC: '/tokens/btc.svg',
}

export const tokenNames: Record<TokenSymbol, string> = {
  USDC: 'USD Coin',
  USDT0: 'USDT0, Tether over LayerZero',
  XLM: 'Stellar Lumens',
  TRY: 'Türk lirası',
  ETH: 'Wrapped Ether',
  BTC: 'Wrapped Bitcoin',
}

export function TokenIcon({ symbol, size = 24, className = '' }: { symbol: TokenSymbol; size?: number; className?: string }) {
  return (
    <span
      className={'inline-flex shrink-0 overflow-hidden rounded-full border border-line bg-surface ' + className}
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
