import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import { Networks } from '@creit.tech/stellar-wallets-kit/types'
import { NETWORK_PASSPHRASE } from '../config'
import type { Signer } from './chain'

StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET })

interface WalletContextValue {
  address: string | null
  signer: Signer | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  signer: null,
  connect: async () => undefined,
  disconnect: async () => undefined,
})

const STORAGE_KEY = 'paralyx.address'

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setAddress(saved)
    } catch {
      setAddress(null)
    }
  }, [])

  const connect = useCallback(async () => {
    const result = await StellarWalletsKit.authModal()
    setAddress(result.address)
    try {
      localStorage.setItem(STORAGE_KEY, result.address)
    } catch {
      return
    }
  }, [])

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect().catch(() => undefined)
    setAddress(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      return
    }
  }, [])

  const signer = useMemo<Signer | null>(() => {
    if (!address) return null
    return {
      address,
      sign: async (xdr: string) => {
        const result = await StellarWalletsKit.signTransaction(xdr, { address, networkPassphrase: NETWORK_PASSPHRASE })
        return result.signedTxXdr
      },
    }
  }, [address])

  const value = useMemo(() => ({ address, signer, connect, disconnect }), [address, signer, connect, disconnect])
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext)
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
