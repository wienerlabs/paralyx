export type NetworkId = 'testnet' | 'mainnet'

export interface ReserveEntry {
  asset: string
  symbol: 'USDC' | 'XLM' | 'ETH' | 'BTC'
  label: string
}

export interface Network {
  id: NetworkId
  label: string
  passphrase: string
  rpcUrl: string
  rpcUrls: string[]
  horizonUrl: string
  friendbotUrl: string | null
  explorerTx: string
  explorerContract: string
  creditLine: string
  pool: string
  oracle: string
  xlmSac: string
  usdcSac: string
  usdcIssuer: string
  anchorUsdcSac: string
  anchorUsdcIssuer: string
  reserves: ReserveEntry[]
  sandboxAnchor: boolean
  usdt0Issuer: string | null
}

const STORAGE_KEY = 'paralyx.network'

export const NETWORKS: Record<NetworkId, Network> = {
  testnet: {
    id: 'testnet',
    label: 'Testnet',
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    rpcUrls: ['https://soroban-testnet.stellar.org'],
    horizonUrl: 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
    explorerTx: 'https://stellar.expert/explorer/testnet/tx/',
    explorerContract: 'https://stellar.expert/explorer/testnet/contract/',
    creditLine: 'CDZ22YMZKGQZVHJKRJITRZREFKCTCURUKRC63G7ABIPO6SBHXTXL5Z4B',
    pool: 'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF',
    oracle: 'CAZOKR2Y5E2OSWSIBRVZMJ47RUTQPIGVWSAQ2UISGAVC46XKPGDG5PKI',
    xlmSac: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    usdcSac: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    usdcIssuer: 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56',
    anchorUsdcSac: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    anchorUsdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    reserves: [
      { asset: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU', symbol: 'USDC', label: 'USDC' },
      { asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', symbol: 'XLM', label: 'XLM' },
      { asset: 'CAZAQB3D7KSLSNOSQKYD2V4JP5V2Y3B4RDJZRLBFCCIXDCTE3WHSY3UE', symbol: 'ETH', label: 'wETH' },
      { asset: 'CAP5AMC2OHNVREO66DFIN6DHJMPOBAJ2KCDDIMFBR7WWJH5RZBFM3UEI', symbol: 'BTC', label: 'wBTC' },
    ],
    sandboxAnchor: true,
    usdt0Issuer: null,
  },
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://soroban-rpc.creit.tech',
    rpcUrls: ['https://soroban-rpc.creit.tech', 'https://mainnet.sorobanrpc.com'],
    horizonUrl: 'https://horizon.stellar.org',
    friendbotUrl: null,
    explorerTx: 'https://stellar.expert/explorer/public/tx/',
    explorerContract: 'https://stellar.expert/explorer/public/contract/',
    creditLine: 'CDCYHJPSXA6YT5HWXOWN5R6NL2BMD5PCIXGPBVOU2C4MJHFVV6LC7ITC',
    pool: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
    oracle: 'CCVTVW2CVA7JLH4ROQGP3CU4T3EXVCK66AZGSM4MUQPXAI4QHCZPOATS',
    xlmSac: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
    usdcSac: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    anchorUsdcSac: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    anchorUsdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    reserves: [
      { asset: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', symbol: 'USDC', label: 'USDC' },
      { asset: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', symbol: 'XLM', label: 'XLM' },
    ],
    sandboxAnchor: false,
    usdt0Issuer: 'GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q',
  },
}

export function currentNetworkId(): NetworkId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'mainnet' ? 'mainnet' : 'testnet'
  } catch {
    return 'testnet'
  }
}

export function switchNetwork(id: NetworkId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    return
  }
  window.location.reload()
}

export const NETWORK: Network = NETWORKS[currentNetworkId()]
export const NETWORK_ID: NetworkId = NETWORK.id
export const IS_MAINNET = NETWORK.id === 'mainnet'

export const NETWORK_PASSPHRASE = NETWORK.passphrase
export const RPC_URL = NETWORK.rpcUrl
export const RPC_URLS = NETWORK.rpcUrls
export const MAINNET_RPC_URLS = NETWORKS.mainnet.rpcUrls
export const HORIZON_URL = NETWORK.horizonUrl
export const FRIENDBOT_URL = NETWORK.friendbotUrl ?? ''
export const EXPLORER_TX = NETWORK.explorerTx
export const EXPLORER_CONTRACT = NETWORK.explorerContract

export const CREDIT_LINE_CONTRACT = NETWORK.creditLine
export const BLEND_POOL = NETWORK.pool
export const BLEND_ORACLE = NETWORK.oracle
export const XLM_SAC = NETWORK.xlmSac
export const BLEND_USDC_SAC = NETWORK.usdcSac
export const BLEND_USDC_ISSUER = NETWORK.usdcIssuer
export const CIRCLE_USDC_SAC = NETWORK.anchorUsdcSac
export const CIRCLE_USDC_ISSUER = NETWORK.anchorUsdcIssuer
export const USDT0_ISSUER = NETWORK.usdt0Issuer
export const HAS_SANDBOX_ANCHOR = NETWORK.sandboxAnchor
export const READ_SOURCE_ACCOUNT = 'GDOZ44UXCLBBUTRQFOI6G5HQ5MGHG2LLEXALFKP4MTQBWEFHKPHDV52F'

export const ANCHOR_HOME_DOMAIN = 'tr-mock-anchor.fly.dev'
export const ANCHOR_BASE = 'https://tr-mock-anchor.fly.dev'
export const ANCHOR_TREASURY = 'GCLCZEQZ2THTEDAOFI66LACNPLY4OBKN7VKLEZFMBIHYKYQOW2W7T3Z6'
export const ANCHOR_USDC_ASSET = `stellar:USDC:${NETWORKS.testnet.anchorUsdcIssuer}`
export const ANCHOR_TRY_ASSET = 'iso4217:TRY'
export const ANCHOR_MAX_USDC = 300
export const ANCHOR_MAX_TRY = 3000
export const USDT0_TRANSFER_URL = 'https://usdt0.to/transfer'

export const SCALAR_7 = 10_000_000n
export const SCALAR_12 = 1_000_000_000_000n
export const SAFETY_BUFFER = 0.97
export const SHOW_BACKGROUND = true
