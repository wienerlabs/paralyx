import { useCallback, useEffect, useRef, useState } from 'react'
import { NETWORK_ID } from '../config'

type Loader<T> = () => Promise<T>

interface Entry {
  value: unknown
  updatedAt: number
  inflight: Promise<unknown> | null
  error: string | null
}

export interface CacheOptions {
  ttl?: number
  persist?: boolean
  refreshMs?: number
}

const PREFIX = `paralyx:${NETWORK_ID}:`
const entries = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
const inflightListeners = new Set<(count: number) => void>()
let inflightCount = 0

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { __big: value.toString() } : value
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__big' in (value as Record<string, unknown>)) {
    return BigInt((value as { __big: string }).__big)
  }
  return value
}

function readPersisted(key: string): { value: unknown; updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw, reviver) as { value: unknown; updatedAt: number }) : null
  } catch {
    return null
  }
}

function writePersisted(key: string, value: unknown, updatedAt: number): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, updatedAt }, replacer))
  } catch {
    return
  }
}

function entryFor(key: string, persist: boolean): Entry {
  let entry = entries.get(key)
  if (!entry) {
    const persisted = persist ? readPersisted(key) : null
    entry = { value: persisted?.value, updatedAt: persisted?.updatedAt ?? 0, inflight: null, error: null }
    entries.set(key, entry)
  }
  return entry
}

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener())
}

function bumpInflight(delta: number): void {
  inflightCount = Math.max(0, inflightCount + delta)
  inflightListeners.forEach((listener) => listener(inflightCount))
}

export function peek<T>(key: string): T | undefined {
  return entries.get(key)?.value as T | undefined
}

export function load<T>(key: string, loader: Loader<T>, options: CacheOptions & { force?: boolean } = {}): Promise<T> {
  const { ttl = 30_000, persist = false, force = false } = options
  const entry = entryFor(key, persist)
  if (!force && entry.value !== undefined && Date.now() - entry.updatedAt < ttl) return Promise.resolve(entry.value as T)
  if (entry.inflight) return entry.inflight as Promise<T>
  bumpInflight(1)
  const promise = loader()
    .then((value) => {
      entry.value = value
      entry.updatedAt = Date.now()
      entry.error = null
      if (persist) writePersisted(key, value, entry.updatedAt)
      return value
    })
    .catch((error: unknown) => {
      entry.error = error instanceof Error ? error.message : String(error)
      throw error
    })
    .finally(() => {
      entry.inflight = null
      bumpInflight(-1)
      notify(key)
    })
  entry.inflight = promise
  notify(key)
  return promise
}

export function invalidate(prefix?: string): void {
  for (const [key, entry] of entries) {
    if (!prefix || key.startsWith(prefix)) entry.updatedAt = 0
  }
}

export interface Cached<T> {
  data: T | undefined
  updatedAt: number
  loading: boolean
  error: string | null
  refresh: () => Promise<T | undefined>
}

export function useCached<T>(key: string | null, loader: Loader<T>, options: CacheOptions = {}): Cached<T> {
  const [, tick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const { ttl, persist = false, refreshMs } = options

  useEffect(() => {
    if (!key) return
    const listener = () => tick((value) => value + 1)
    let set = listeners.get(key)
    if (!set) {
      set = new Set()
      listeners.set(key, set)
    }
    set.add(listener)
    load(key, () => loaderRef.current(), { ttl, persist }).catch(() => undefined)
    let timer: ReturnType<typeof setInterval> | null = null
    if (refreshMs) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') load(key, () => loaderRef.current(), { ttl, persist, force: true }).catch(() => undefined)
      }, refreshMs)
    }
    return () => {
      set?.delete(listener)
      if (timer) clearInterval(timer)
    }
  }, [key, ttl, persist, refreshMs])

  const refresh = useCallback(async () => {
    if (!key) return undefined
    return load(key, () => loaderRef.current(), { ttl, persist, force: true })
  }, [key, ttl, persist])

  const entry = key ? entryFor(key, persist) : null
  return {
    data: entry?.value as T | undefined,
    updatedAt: entry?.updatedAt ?? 0,
    loading: Boolean(entry?.inflight),
    error: entry?.error ?? null,
    refresh,
  }
}

export function useInflight(): number {
  const [count, setCount] = useState(inflightCount)
  useEffect(() => {
    inflightListeners.add(setCount)
    return () => {
      inflightListeners.delete(setCount)
    }
  }, [])
  return count
}
