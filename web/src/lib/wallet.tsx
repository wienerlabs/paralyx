import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import { Networks, type ISupportedWallet } from '@creit.tech/stellar-wallets-kit/types'
import { NETWORK_PASSPHRASE } from '../config'
import type { Signer } from './chain'

StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET })

interface WalletContextValue {
  address: string | null
  walletId: string | null
  walletName: string | null
  signer: Signer | null
  supported: ISupportedWallet[]
  connectOpen: boolean
  connecting: string | null
  openConnect: () => void
  closeConnect: () => void
  connect: (wallet: ISupportedWallet) => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  walletId: null,
  walletName: null,
  signer: null,
  supported: [],
  connectOpen: false,
  connecting: null,
  openConnect: () => undefined,
  closeConnect: () => undefined,
  connect: async () => undefined,
  disconnect: async () => undefined,
})

const STORAGE_KEY = 'paralyx.wallet'

interface Saved {
  address: string
  walletId: string
  walletName: string
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function writeSaved(value: Saved | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function sortWallets(list: ISupportedWallet[]): ISupportedWallet[] {
  const rank = (wallet: ISupportedWallet) => (wallet.isAvailable ? 0 : 1) + (wallet.name.toLowerCase().includes('freighter') ? 0 : 0.5)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [supported, setSupported] = useState<ISupportedWallet[]>([])
  const [connectOpen, setConnectOpen] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    const stored = readSaved()
    if (stored) {
      setSaved(stored)
      try {
        StellarWalletsKit.setWallet(stored.walletId)
      } catch {
        return
      }
    }
  }, [])

  const loadSupported = useCallback(async () => {
    try {
      const list = await StellarWalletsKit.refreshSupportedWallets()
      setSupported(sortWallets(list))
    } catch {
      setSupported([])
    }
  }, [])

  const openConnect = useCallback(() => {
    setConnectOpen(true)
    void loadSupported()
  }, [loadSupported])

  const closeConnect = useCallback(() => setConnectOpen(false), [])

  const connect = useCallback(async (wallet: ISupportedWallet) => {
    setConnecting(wallet.id)
    try {
      StellarWalletsKit.setWallet(wallet.id)
      const { address } = await StellarWalletsKit.fetchAddress()
      const next = { address, walletId: wallet.id, walletName: wallet.name }
      setSaved(next)
      writeSaved(next)
      setConnectOpen(false)
    } finally {
      setConnecting(null)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect().catch(() => undefined)
    setSaved(null)
    writeSaved(null)
  }, [])

  const signer = useMemo<Signer | null>(() => {
    if (!saved) return null
    const { address, walletId } = saved
    return {
      address,
      sign: async (xdr: string) => {
        StellarWalletsKit.setWallet(walletId)
        const result = await StellarWalletsKit.signTransaction(xdr, { address, networkPassphrase: NETWORK_PASSPHRASE })
        return result.signedTxXdr
      },
    }
  }, [saved])

  const value = useMemo<WalletContextValue>(
    () => ({
      address: saved?.address ?? null,
      walletId: saved?.walletId ?? null,
      walletName: saved?.walletName ?? null,
      signer,
      supported,
      connectOpen,
      connecting,
      openConnect,
      closeConnect,
      connect,
      disconnect,
    }),
    [saved, signer, supported, connectOpen, connecting, openConnect, closeConnect, connect, disconnect],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext)
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
