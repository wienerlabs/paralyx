import { useEffect, useState } from 'react'
import { OWNER_ACCOUNTS, type SavedAccount } from '../config'

const KEY = 'paralyx:saved-accounts'
const EVENT = 'paralyx-saved-accounts'

function readLocal(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedAccount[]) : []
  } catch {
    return []
  }
}

function writeLocal(accounts: SavedAccount[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts))
  } catch {
    return
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function saveAccount(account: Omit<SavedAccount, 'id' | 'builtIn'>): SavedAccount {
  const entry: SavedAccount = { ...account, id: `local-${Date.now()}`, builtIn: false }
  const existing = readLocal().filter((item) => !(item.address === entry.address && item.memo === entry.memo))
  writeLocal([entry, ...existing].slice(0, 10))
  return entry
}

export function removeAccount(id: string): void {
  writeLocal(readLocal().filter((item) => item.id !== id))
}

export function useSavedAccounts(): SavedAccount[] {
  const [local, setLocal] = useState<SavedAccount[]>(() => readLocal())
  useEffect(() => {
    const refresh = () => setLocal(readLocal())
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return [...OWNER_ACCOUNTS, ...local]
}
