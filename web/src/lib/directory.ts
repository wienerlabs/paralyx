export interface DirectoryEntry {
  name: string
  domain: string
  tags: string[]
}

const cache = new Map<string, DirectoryEntry | null>()

export async function lookupDirectory(address: string): Promise<DirectoryEntry | null> {
  if (cache.has(address)) return cache.get(address) ?? null
  const response = await fetch(`https://api.stellar.expert/explorer/directory/${address}`)
  if (response.status === 404) {
    cache.set(address, null)
    return null
  }
  if (!response.ok) throw new Error('directory unavailable')
  const body = (await response.json()) as { name?: string; domain?: string; tags?: string[] }
  const entry = { name: body.name ?? '', domain: body.domain ?? '', tags: body.tags ?? [] }
  cache.set(address, entry)
  return entry
}
