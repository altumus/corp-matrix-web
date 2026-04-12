import path from 'path';
import { CONFIG, bugs, testLog, consoleErrors, networkErrors, incrementScreenshotIdx } from './config.js';

// ═════════════���═════════════════════════════════════════════════
// HELPERS
// ═══════════���════════════════════════════���══════════════════════
export function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const entry = `[${ts}] ${msg}`;
  testLog.push(entry);
  console.log(entry);
}

export async function snap(page, name) {
  const idx = incrementScreenshotIdx();
  const filename = `${String(idx).padStart(3, '0')}-${name}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
  } catch { /* page might have navigated */ }
  return filename;
}

export function bug(severity, scenario, description, steps, screenshot) {
  bugs.push({ severity, scenario, description, steps, screenshot });
  log(`BUG [${severity}] ${scenario}: ${description}`);
}

export async function safe(label, fn) {
  try { return await fn(); }
  catch (err) { log(`ERROR in ${label}: ${err.message}`); return null; }
}

/**
 * Run a single test in isolation: catch any unhandled error so one bad test
 * doesn't crash the whole suite. Logs a HIGH bug for the failing scenario and
 * tries to dismiss leftover modals before returning.
 */
export async function runTest(name, page, fn) {
  try {
    await fn();
  } catch (err) {
    log(`${name}: CRASH — ${err.message.split('\n')[0]}`);
    const shot = await snap(page, `crash-${name.toLowerCase()}`).catch(() => '');
    bug('HIGH', name, `Test crashed: ${err.message.slice(0, 200)}`, [], shot);
    // Best-effort cleanup so subsequent tests aren't blocked by leftover overlays
    try { await page.keyboard.press('Escape'); } catch { /* ignore */ }
    await page.waitForTimeout(300);
  }
}

export function listen(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: label, text: msg.text(), ts: new Date().toISOString() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ page: label, text: err.message, ts: new Date().toISOString() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ page: label, url: res.url(), status: res.status(), ts: new Date().toISOString() });
    }
  });
}

/** Wait for a selector with a fallback — returns element or null */
export async function waitFor(page, selector, timeout = CONFIG.timeout) {
  try {
    return await page.waitForSelector(selector, { timeout });
  } catch { return null; }
}

/** Dismiss KeyRestoreScreen if it appears (click "Skip for now") */
export async function dismissKeyRestore(page) {
  const skipBtn = await page.$('[class*="skipButton"], button:has-text("Skip"), button:has-text("Пропустить")');
  if (skipBtn) {
    log('Key restore screen detected — clicking Skip');
    await skipBtn.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

/** Navigate to app and wait for it to be ready (not networkidle — Matrix WS keeps connection open) */
export async function goto(page, urlPath, waitSelector) {
  await page.goto(`${CONFIG.appUrl}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
  await page.waitForTimeout(1500);
  await dismissKeyRestore(page);
  if (waitSelector) {
    await waitFor(page, waitSelector, CONFIG.timeout);
  }
}

// Selector for room list items (NOT spaces sidebar items).
export const ROOM_ITEM_SEL = 'button[class*="item"]:has([class*="content"])';

/** Navigate to a room: enters first room or specified room item */
export async function ensureInRoom(page) {
  if (page.url().includes('/rooms/!') || page.url().includes('/rooms/%21')) {
    await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 5000);
    return true;
  }
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  const item = await page.$(ROOM_ITEM_SEL);
  if (!item) { log('No rooms available'); return false; }
  await item.click();
  const composer = await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 8000);
  if (!composer) {
    log('Room entered but composer not found');
    await page.waitForTimeout(2000);
  }
  return page.url().includes('/rooms/');
}

/** Login helper */
export async function loginAs(page, user) {
  await goto(page, '/login', 'input[autocomplete="username"]');

  const hs = await page.$('input[autocomplete="url"]');
  if (hs) { await hs.fill(''); await hs.fill(CONFIG.homeserver); }

  const u = await page.$('input[autocomplete="username"]');
  const p = await page.$('input[type="password"]');
  if (!u || !p) return false;

  await u.fill(user.username);
  await p.fill(user.password);
  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();

  // Wait for either /rooms or the key restore screen
  try {
    await page.waitForURL('**/rooms**', { timeout: 10000 });
  } catch {
    // URL didn't change to /rooms — might be on key restore screen
  }

  // Check for key restore screen and dismiss it
  await page.waitForTimeout(2000);
  await dismissKeyRestore(page);

  // Now wait for the room list to appear
  try {
    await waitFor(page, `${ROOM_ITEM_SEL}, [class*="list"], [role="status"]`, 10000);
    await page.waitForTimeout(1500);
    return page.url().includes('/rooms') || page.url().includes('/login') === false;
  } catch { return false; }
}
