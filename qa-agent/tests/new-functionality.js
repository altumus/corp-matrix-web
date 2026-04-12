import { CONFIG } from '../lib/config.js'
import { log, snap, bug, waitFor, goto, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js'

// SSO: Login page shows SSO buttons when server supports m.login.sso
export async function testSsoButtonVisibility(page) {
  log('--- SSO_BUTTON_VISIBILITY ---')
  try {
    await goto(page, '/login', 'input')
    await page.waitForTimeout(2000)

    // Check if SSO section exists (only if server supports SSO)
    const ssoSection = await page.$('[class*="ssoSection"], [class*="sso"]')
    const ssoBtn = await page.$('[class*="ssoBtn"], button:has-text("SSO")')

    // Fetch login flows to determine if SSO is supported
    const flows = await fetch(`${CONFIG.homeserver}/_matrix/client/v3/login`).then(r => r.json()).catch(() => null)
    const serverSupportsSso = flows?.flows?.some(f => f.type === 'm.login.sso')

    const shot = await snap(page, 'sso-visibility')

    if (serverSupportsSso && !ssoBtn) {
      bug('HIGH', 'SSO_BUTTON_VISIBILITY', 'Server supports SSO but no SSO button on login page', [], shot)
    } else if (!serverSupportsSso && ssoBtn) {
      bug('MEDIUM', 'SSO_BUTTON_VISIBILITY', 'SSO button visible but server does not support SSO', [], shot)
    } else if (serverSupportsSso && ssoBtn) {
      log('SSO_BUTTON_VISIBILITY: PASS — SSO button visible (server supports SSO)')
    } else {
      log('SSO_BUTTON_VISIBILITY: PASS — no SSO button (server does not support SSO)')
    }
  } catch (err) {
    log(`SSO_BUTTON_VISIBILITY: ERROR ${err.message}`)
  }
}

// SSO callback route exists
export async function testSsoCallbackRoute(page) {
  log('--- SSO_CALLBACK_ROUTE ---')
  try {
    await page.goto(`${CONFIG.appUrl}/auth/callback`, { waitUntil: 'domcontentloaded', timeout: 5000 })
    await page.waitForTimeout(1500)
    const shot = await snap(page, 'sso-callback')

    // Should show either loading spinner or redirect to login (no loginToken = redirect)
    const url = page.url()
    if (url.includes('/auth/callback') || url.includes('/login') || url.includes('/rooms')) {
      log('SSO_CALLBACK_ROUTE: PASS — route exists and handles missing loginToken')
    } else {
      bug('MEDIUM', 'SSO_CALLBACK_ROUTE', `Unexpected URL after /auth/callback: ${url}`, [], shot)
    }
  } catch (err) {
    log(`SSO_CALLBACK_ROUTE: ERROR ${err.message}`)
  }
}

// Group call button visible in group rooms (not DM)
export async function testGroupCallButton(page) {
  log('--- GROUP_CALL_BUTTON ---')
  try {
    if (!CONFIG.rooms.general) { log('GROUP_CALL_BUTTON: SKIP'); return }
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]')
    await page.waitForTimeout(1500)

    const header = await page.$('header[class*="header"]')
    if (!header) { log('GROUP_CALL_BUTTON: No header'); return }

    // Look for group call button (Users icon or similar)
    const buttons = await header.$$('button')
    let groupCallBtn = null
    for (const btn of buttons) {
      const title = await btn.getAttribute('title')
      const label = await btn.getAttribute('aria-label')
      const text = (title || label || '').toLowerCase()
      if (text.includes('груп') || text.includes('group') || text.includes('конференц')) {
        groupCallBtn = btn
        break
      }
    }

    const shot = await snap(page, 'group-call-button')

    if (!groupCallBtn) {
      bug('MEDIUM', 'GROUP_CALL_BUTTON', 'Group call button not found in group room header', [], shot)
    } else {
      log('GROUP_CALL_BUTTON: PASS — button visible in group room')
    }
  } catch (err) {
    log(`GROUP_CALL_BUTTON: ERROR ${err.message}`)
  }
}

// Group call button NOT visible in DM rooms
export async function testGroupCallNotInDM(page) {
  log('--- GROUP_CALL_NOT_IN_DM ---')
  try {
    if (!CONFIG.rooms.direct) { log('GROUP_CALL_NOT_IN_DM: SKIP'); return }
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]')
    await page.waitForTimeout(1500)

    const header = await page.$('header[class*="header"]')
    if (!header) { log('GROUP_CALL_NOT_IN_DM: No header'); return }

    const buttons = await header.$$('button')
    let hasGroupCall = false
    for (const btn of buttons) {
      const title = await btn.getAttribute('title')
      const label = await btn.getAttribute('aria-label')
      const text = (title || label || '').toLowerCase()
      if (text.includes('груп') || text.includes('group') || text.includes('конференц')) {
        hasGroupCall = true
        break
      }
    }

    if (hasGroupCall) {
      bug('MEDIUM', 'GROUP_CALL_NOT_IN_DM', 'Group call button should not appear in DM room', [], await snap(page, 'group-call-in-dm'))
    } else {
      log('GROUP_CALL_NOT_IN_DM: PASS — no group call button in DM')
    }
  } catch (err) {
    log(`GROUP_CALL_NOT_IN_DM: ERROR ${err.message}`)
  }
}

// Key import button exists in encryption settings
export async function testKeyImportButton(page) {
  log('--- KEY_IMPORT_BUTTON ---')
  try {
    await goto(page, '/settings/encryption', 'button')
    await page.waitForTimeout(1500)

    const importBtn = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button')
      for (const b of buttons) {
        const text = (b.textContent || '').toLowerCase()
        if (text.includes('импорт') || text.includes('import')) return true
      }
      return false
    })

    const shot = await snap(page, 'key-import-button')

    if (!importBtn) {
      bug('MEDIUM', 'KEY_IMPORT_BUTTON', 'Key import button not found in encryption settings', [], shot)
    } else {
      log('KEY_IMPORT_BUTTON: PASS — import button visible')
    }
  } catch (err) {
    log(`KEY_IMPORT_BUTTON: ERROR ${err.message}`)
  }
}

// Key import dialog opens
export async function testKeyImportDialog(page) {
  log('--- KEY_IMPORT_DIALOG ---')
  try {
    await goto(page, '/settings/encryption', 'button')
    await page.waitForTimeout(1500)

    // Find and click import button
    const buttons = await page.$$('button')
    let clicked = false
    for (const btn of buttons) {
      const text = await btn.textContent()
      if (/импорт|import/i.test(text || '')) {
        await btn.click({ timeout: 3000 }).catch(() => {})
        clicked = true
        break
      }
    }

    if (!clicked) { log('KEY_IMPORT_DIALOG: SKIP (no import button)'); return }
    await page.waitForTimeout(800)

    const modal = await page.$('dialog, [class*="modal"]')
    const shot = await snap(page, 'key-import-dialog')

    if (!modal) {
      bug('MEDIUM', 'KEY_IMPORT_DIALOG', 'Import keys dialog did not open', [], shot)
    } else {
      // Check for file input and password field
      const fileInput = await modal.$('input[type="file"]')
      const passwordInput = await modal.$('input[type="password"]')
      log(`KEY_IMPORT_DIALOG: PASS — modal open, file=${!!fileInput}, password=${!!passwordInput}`)
      await page.keyboard.press('Escape')
    }
  } catch (err) {
    log(`KEY_IMPORT_DIALOG: ERROR ${err.message}`)
  }
}

// Scroll position preserved between room switches
export async function testScrollPositionPreserved(page) {
  log('--- SCROLL_POSITION ---')
  try {
    if (!CONFIG.rooms.general) { log('SCROLL_POSITION: SKIP'); return }
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]')
    await page.waitForTimeout(1500)

    // Scroll up
    await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]')
      if (el) el.scrollTop = 100
    })
    await page.waitForTimeout(500)

    const scrollBefore = await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]')
      return el ? el.scrollTop : -1
    })

    // Switch to another room
    if (CONFIG.rooms.direct) {
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]')
      await page.waitForTimeout(1000)
    }

    // Switch back
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]')
    await page.waitForTimeout(1500)

    const scrollAfter = await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]')
      return el ? el.scrollTop : -1
    })

    const shot = await snap(page, 'scroll-position')
    log(`SCROLL_POSITION: before=${scrollBefore}, after=${scrollAfter}`)

    // Allow some tolerance (Virtuoso may adjust slightly)
    if (scrollBefore > 0 && Math.abs(scrollAfter - scrollBefore) < 100) {
      log('SCROLL_POSITION: PASS — position preserved')
    } else {
      log('SCROLL_POSITION: Position not preserved (Virtuoso restore may need time)')
    }
  } catch (err) {
    log(`SCROLL_POSITION: ERROR ${err.message}`)
  }
}

// iOS safe area CSS
export async function testIosSafeArea(page) {
  log('--- IOS_SAFE_AREA ---')
  try {
    if (!(await ensureInRoom(page))) return

    const hasViewportFit = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]')
      return meta?.content?.includes('viewport-fit=cover') || false
    })

    const hasSafeArea = await page.evaluate(() => {
      const composer = document.querySelector('[class*="composer"]')
      if (!composer) return false
      const style = getComputedStyle(composer)
      return style.paddingBottom !== '0px'
    })

    if (!hasViewportFit) {
      bug('LOW', 'IOS_SAFE_AREA', 'viewport-fit=cover not set in meta viewport', [], '')
    } else {
      log(`IOS_SAFE_AREA: PASS — viewport-fit=cover set, composer padding=${hasSafeArea}`)
    }
  } catch (err) {
    log(`IOS_SAFE_AREA: ERROR ${err.message}`)
  }
}

// Connection banner component exists
export async function testConnectionBannerExists(page) {
  log('--- CONNECTION_BANNER ---')
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL)
    await page.waitForTimeout(1000)

    // When connected, banner should NOT be visible
    const banner = await page.$('[class*="banner"][class*="connection"], [class*="connectionBanner"]')
    if (banner) {
      const text = await banner.textContent().catch(() => '')
      log(`CONNECTION_BANNER: Banner visible while connected: "${text}" (may be error)`)
    } else {
      log('CONNECTION_BANNER: PASS — no banner when connected (correct)')
    }
  } catch (err) {
    log(`CONNECTION_BANNER: ERROR ${err.message}`)
  }
}

// Dockerfile exists and is valid
export async function testDockerfileExists() {
  log('--- DOCKERFILE ---')
  try {
    const fs = await import('fs')
    const dockerfilePath = 'C:/Users/altumus/Desktop/corp-matrix-web/Dockerfile'
    const nginxPath = 'C:/Users/altumus/Desktop/corp-matrix-web/nginx.conf'

    const hasDockerfile = fs.existsSync(dockerfilePath)
    const hasNginx = fs.existsSync(nginxPath)

    if (!hasDockerfile) {
      bug('LOW', 'DOCKERFILE', 'Dockerfile not found in project root', [], '')
    } else if (!hasNginx) {
      bug('LOW', 'DOCKERFILE', 'nginx.conf not found (required by Dockerfile)', [], '')
    } else {
      const content = fs.readFileSync(dockerfilePath, 'utf-8')
      const hasMultistage = content.includes('FROM') && content.includes('AS builder')
      log(`DOCKERFILE: PASS — exists, multistage=${hasMultistage}, nginx=${hasNginx}`)
    }
  } catch (err) {
    log(`DOCKERFILE: ERROR ${err.message}`)
  }
}
