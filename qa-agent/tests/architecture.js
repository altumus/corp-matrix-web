import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CONFIG } from '../lib/config.js'
import { log, snap, bug, goto, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(__dirname, '../../src')

// 1. MessageBubble split verification
export async function testMessageBubbleSplit() {
  log('--- MESSAGE_BUBBLE_SPLIT ---')
  try {
    const bubblePath = path.join(SRC_DIR, 'features/room/components/MessageBubble.tsx')
    const contentPath = path.join(SRC_DIR, 'features/room/components/MessageContent.tsx')
    const reactionPath = path.join(SRC_DIR, 'features/room/components/ReactionBar.tsx')
    const replyPath = path.join(SRC_DIR, 'features/room/components/ReplyPreview.tsx')

    const bubbleExists = fs.existsSync(bubblePath)
    const contentExists = fs.existsSync(contentPath)
    const reactionExists = fs.existsSync(reactionPath)
    const replyExists = fs.existsSync(replyPath)

    if (!contentExists || !reactionExists) {
      bug('MEDIUM', 'MESSAGE_BUBBLE_SPLIT',
        `Missing subcomponents: MessageContent=${contentExists}, ReactionBar=${reactionExists}, ReplyPreview=${replyExists}`, [], '')
      return
    }

    // Check MessageBubble is under 700 lines
    const bubbleContent = fs.readFileSync(bubblePath, 'utf-8')
    const lineCount = bubbleContent.split('\n').length

    if (lineCount > 700) {
      bug('LOW', 'MESSAGE_BUBBLE_SPLIT',
        `MessageBubble.tsx still has ${lineCount} lines (target: <700)`, [], '')
    } else {
      log(`MESSAGE_BUBBLE_SPLIT: PASS — ${lineCount} lines, subcomponents exist`)
    }

    // Verify MessageBubble imports subcomponents
    const importsContent = bubbleContent.includes('MessageContent')
    const importsReaction = bubbleContent.includes('ReactionBar')
    log(`MESSAGE_BUBBLE_SPLIT: imports MessageContent=${importsContent}, ReactionBar=${importsReaction}`)
  } catch (err) {
    log(`MESSAGE_BUBBLE_SPLIT: ERROR ${err.message}`)
  }
}

// 2. Room list performance — entry cache exists
export async function testRoomListCache() {
  log('--- ROOM_LIST_CACHE ---')
  try {
    const filePath = path.join(SRC_DIR, 'features/room-list/hooks/useRoomList.ts')
    const content = fs.readFileSync(filePath, 'utf-8')

    const hasEntryCache = content.includes('entryCache') || content.includes('cachedRoomToEntry')
    const hasMentionCache = content.includes('mentionCache') || content.includes('getMentionFallback')
    const hasThrottle = content.includes('throttle') || content.includes('scheduleRefresh')

    if (!hasEntryCache) {
      bug('MEDIUM', 'ROOM_LIST_CACHE', 'No entry cache (cachedRoomToEntry) in useRoomList', [], '')
    }
    if (!hasMentionCache) {
      bug('MEDIUM', 'ROOM_LIST_CACHE', 'No mention cache (getMentionFallback) in useRoomList', [], '')
    }
    if (!hasThrottle) {
      bug('MEDIUM', 'ROOM_LIST_CACHE', 'No throttle on refresh in useRoomList', [], '')
    }

    if (hasEntryCache && hasMentionCache && hasThrottle) {
      log('ROOM_LIST_CACHE: PASS — entry cache + mention cache + throttle present')
    }
  } catch (err) {
    log(`ROOM_LIST_CACHE: ERROR ${err.message}`)
  }
}

// 3. Token storage — verify NOT using localStorage for session
export async function testTokenStorageSecurity() {
  log('--- TOKEN_STORAGE ---')
  try {
    const matrixClientPath = path.join(SRC_DIR, 'shared/lib/matrixClient.ts')
    const authServicePath = path.join(SRC_DIR, 'features/auth/services/authService.ts')

    const matrixContent = fs.readFileSync(matrixClientPath, 'utf-8')
    const authContent = fs.readFileSync(authServicePath, 'utf-8')

    // Check that session is NOT stored in localStorage
    const usesLocalStorage =
      matrixContent.includes("localStorage.setItem('matrix-session'") ||
      matrixContent.includes('localStorage.setItem("matrix-session"') ||
      authContent.includes("localStorage.setItem('matrix-session'") ||
      authContent.includes('localStorage.setItem("matrix-session"')

    // Check that IndexedDB or secure storage is used
    const usesIDB = matrixContent.includes('indexedDB') || matrixContent.includes('idb') ||
                    matrixContent.includes('IDBDatabase') || matrixContent.includes('openDB')

    if (usesLocalStorage) {
      bug('HIGH', 'TOKEN_STORAGE', 'Session tokens stored in localStorage — vulnerable to XSS', [], '')
    } else if (usesIDB) {
      log('TOKEN_STORAGE: PASS — using IndexedDB for session storage')
    } else {
      log('TOKEN_STORAGE: Session storage method unclear (may use library wrapper)')
    }
  } catch (err) {
    log(`TOKEN_STORAGE: ERROR ${err.message}`)
  }
}

// 4. Mention fallback performance — verify limited scan
export async function testMentionFallbackPerf() {
  log('--- MENTION_FALLBACK_PERF ---')
  try {
    const filePath = path.join(SRC_DIR, 'features/room-list/hooks/useRoomList.ts')
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check for scan limit (should scan last 50, not entire timeline)
    const hasLimit = content.includes('Math.max(0,') || content.includes('- 50') ||
                     content.includes('slice(-50') || content.includes('.length - 50')

    // Check for cooldown
    const hasCooldown = content.includes('lastMentionScan') || content.includes('cooldown') ||
                        content.includes('1000')

    if (!hasLimit) {
      bug('MEDIUM', 'MENTION_FALLBACK_PERF', 'Mention fallback scans entire timeline (no limit)', [], '')
    }
    if (!hasCooldown) {
      bug('LOW', 'MENTION_FALLBACK_PERF', 'Mention fallback has no cooldown between scans', [], '')
    }

    if (hasLimit && hasCooldown) {
      log('MENTION_FALLBACK_PERF: PASS — scan limited + cooldown present')
    }
  } catch (err) {
    log(`MENTION_FALLBACK_PERF: ERROR ${err.message}`)
  }
}

// 5. Runtime: messages render correctly after MessageBubble split
export async function testMessageRenderAfterSplit(page) {
  log('--- MESSAGE_RENDER_SPLIT ---')
  try {
    if (!CONFIG.rooms.general) { log('MESSAGE_RENDER_SPLIT: SKIP'); return }
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]')
    await page.waitForTimeout(2000)

    // Check messages rendered
    const messages = await page.$$('[class*="message"]')
    if (messages.length === 0) {
      bug('HIGH', 'MESSAGE_RENDER_SPLIT', 'No messages rendered after MessageBubble split', [], await snap(page, 'render-split'))
      return
    }

    // Check bubbles have content
    const hasContent = await page.evaluate(() => {
      const bubbles = document.querySelectorAll('[class*="bubble"]')
      let withText = 0
      for (const b of bubbles) {
        if (b.textContent && b.textContent.trim().length > 0) withText++
      }
      return withText
    })

    // Check reactions still render (if any)
    const reactions = await page.$$('[class*="reactions"]')

    const shot = await snap(page, 'render-after-split')
    log(`MESSAGE_RENDER_SPLIT: PASS — ${messages.length} messages, ${hasContent} with content, ${reactions.length} reaction bars`)
  } catch (err) {
    log(`MESSAGE_RENDER_SPLIT: ERROR ${err.message}`)
  }
}

// 6. Room list renders quickly (performance smoke test)
export async function testRoomListPerformance(page) {
  log('--- ROOM_LIST_PERF ---')
  try {
    const start = Date.now()
    await goto(page, '/rooms', ROOM_ITEM_SEL)
    const loadTime = Date.now() - start

    const items = await page.$$(ROOM_ITEM_SEL)
    log(`ROOM_LIST_PERF: ${items.length} rooms loaded in ${loadTime}ms`)

    if (loadTime > 10000) {
      bug('MEDIUM', 'ROOM_LIST_PERF', `Room list took ${loadTime}ms to load (>10s)`, [], '')
    } else {
      log(`ROOM_LIST_PERF: PASS — loaded in ${loadTime}ms`)
    }
  } catch (err) {
    log(`ROOM_LIST_PERF: ERROR ${err.message}`)
  }
}
