import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'corp-matrix-frequent-emoji'
const MAX_TRACKED = 20
const DEFAULTS = ['👍', '👀', '🔥', '🤝', '❤️', '😂']

interface EmojiCount {
  emoji: string
  count: number
  lastUsed: number
}

function load(): EmojiCount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function save(list: EmojiCount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function trackEmojiUsage(emoji: string): void {
  const list = load()
  const existing = list.find((e) => e.emoji === emoji)
  if (existing) {
    existing.count++
    existing.lastUsed = Date.now()
  } else {
    list.push({ emoji, count: 1, lastUsed: Date.now() })
  }
  // Keep top N by count
  list.sort((a, b) => b.count - a.count)
  save(list.slice(0, MAX_TRACKED))
}

/** Returns top 6 frequently used emoji, falling back to defaults */
export function useFrequentEmoji(): string[] {
  const [list, setList] = useState<string[]>(() => {
    const stored = load()
    if (stored.length === 0) return DEFAULTS
    return stored.slice(0, 6).map((e) => e.emoji)
  })

  const refresh = useCallback(() => {
    const stored = load()
    if (stored.length === 0) {
      setList(DEFAULTS)
    } else {
      setList(stored.slice(0, 6).map((e) => e.emoji))
    }
  }, [])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [refresh])

  return list
}
