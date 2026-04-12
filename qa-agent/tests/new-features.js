import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, loginAs, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';

export async function testD1ContextReactivity(page) {
  log('--- D1_CONTEXT_REACTIVITY ---');
  try {
    await goto(page, '/settings/profile', 'nav, [class*="nav"], [class*="settings"]').catch(() => {});
    await page.waitForTimeout(1000);

    let logoutBtn = await page.$('button:has-text("Выйти")');
    if (!logoutBtn) logoutBtn = await page.$('button:has-text("Logout")');
    if (!logoutBtn) logoutBtn = await page.$('button[class*="logout"]');

    if (!logoutBtn) { log('D1_CONTEXT_REACTIVITY: SKIP (no logout button found)'); return; }

    await logoutBtn.click().catch(() => {});
    await page.waitForTimeout(1500);

    const confirmBtn = await page.$('button:has-text("Выйти"), button:has-text("Confirm"), button:has-text("Подтвердить")');
    if (confirmBtn) { await confirmBtn.click().catch(() => {}); await page.waitForTimeout(1500); }

    const ok = await loginAs(page, CONFIG.users[0]);
    if (!ok) { log('D1_CONTEXT_REACTIVITY: SKIP (re-login failed)'); return; }

    await goto(page, '/settings/encryption', '[class*="settings"], h3').catch(() => {});
    await page.waitForTimeout(2000);

    const hasContent = await page.evaluate(() => {
      const h3 = document.querySelector('h3');
      const settings = document.querySelector('[class*="settings"]');
      const bodyText = document.body.innerText || '';
      return !!(h3 || settings) && bodyText.length > 50;
    });

    const shot = await snap(page, 'd1-context-reactivity');
    if (!hasContent) {
      bug('HIGH', 'D1_CONTEXT_REACTIVITY',
        'After re-login encryption settings are empty/broken — Context not reactive',
        ['1. Logout from /settings/profile', '2. Login again', '3. Navigate to /settings/encryption', '4. Page content is missing'],
        shot);
    } else log('D1_CONTEXT_REACTIVITY: PASS');
  } catch (err) { log(`D1_CONTEXT_REACTIVITY: ERROR ${err.message}`); }
}

export async function testKeyRestoreScreenContent(page) {
  log('--- KEY_RESTORE_METHODS ---');
  try {
    const container = await page.$('[class*="container"]:has([class*="methodGrid"]), [class*="methodGrid"]');
    if (!container) { log('KEY_RESTORE_METHODS: SKIP (screen not visible, keys already loaded)'); return; }

    const methodCards = await page.$$('[class*="methodCard"]');
    const shot = await snap(page, 'key-restore-methods');

    if (methodCards.length < 2) {
      bug('LOW', 'KEY_RESTORE_METHODS',
        `KeyRestoreScreen does not show both recovery methods (key + device verification) — found ${methodCards.length}`,
        ['1. Observe KeyRestoreScreen', '2. Expected 2 method cards', `3. Actual: ${methodCards.length}`],
        shot);
    } else log('KEY_RESTORE_METHODS: PASS');
  } catch (err) { log(`KEY_RESTORE_METHODS: ERROR ${err.message}`); }
}

export async function testNetworkReconnect(page) {
  log('--- NETWORK_RECONNECT ---');
  try {
    if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(1000);

    await page.context().setOffline(true);
    await page.waitForTimeout(4000);

    const shotOff = await snap(page, 'offline-state');
    const hasOfflineIndicator = await page.evaluate(() => {
      if (document.querySelector('[class*="connectionStatus"]')) return true;
      if (document.querySelector('[class*="reconnect"]')) return true;
      if (document.querySelector('[class*="offline"]')) return true;
      const text = (document.body.innerText || '').toLowerCase();
      return text.includes('переподключение') || text.includes('reconnect') || text.includes('офлайн') || text.includes('offline');
    });

    if (!hasOfflineIndicator) {
      bug('LOW', 'NO_OFFLINE_INDICATOR',
        'No visible offline/reconnection indicator while context is offline',
        ['1. Enter room', '2. Set context offline', '3. Wait 4s', '4. No indicator visible'],
        shotOff);
    }

    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    const shotOn = await snap(page, 'online-reconnected');
    const composer = await page.$('[class*="composer"]');
    if (!composer) {
      bug('HIGH', 'RECONNECT_BROKEN',
        'Composer disappeared after reconnect — app broken',
        ['1. Go offline then online', '2. Composer no longer visible'],
        shotOn);
    } else log('NETWORK_RECONNECT: PASS');
  } catch (err) {
    log(`NETWORK_RECONNECT: ERROR ${err.message}`);
    try { await page.context().setOffline(false); } catch (_) {}
  }
}

export async function testServiceWorkerRegistered(page) {
  log('--- SW_REGISTERED ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1500);

    const sw = await page.evaluate(() => {
      try { return navigator.serviceWorker?.controller?.scriptURL || null; } catch (_) { return null; }
    });

    const regCount = await page.evaluate(async () => {
      try {
        if (!navigator.serviceWorker?.getRegistrations) return 0;
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length;
      } catch (_) { return 0; }
    });

    log(`SW: controller=${sw || 'null'}, registrations=${regCount}`);

    if (!sw && regCount === 0) {
      bug('LOW', 'SW_NOT_REGISTERED',
        'PWA service worker not registered/active',
        ['1. Open /rooms', '2. navigator.serviceWorker.controller is null', '3. getRegistrations() empty'],
        '');
    } else log('SW_REGISTERED: PASS');
  } catch (err) { log(`SW_REGISTERED: ERROR ${err.message}`); }
}

export async function testMessageSearchWired(page) {
  log('--- MESSAGE_SEARCH_WIRED ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL).catch(() => {});
    await page.waitForTimeout(1000);

    const searchBtn = await page.$('[class*="searchBtn"]');
    if (!searchBtn) {
      bug('LOW', 'MESSAGE_SEARCH_DEAD_CODE',
        'SearchPanel component exists in code but is not wired up anywhere — no global search button found',
        ['1. Open /rooms', '2. Look for search button in header', '3. Not present'],
        await snap(page, 'message-search-no-btn'));
      return;
    }

    await searchBtn.click();
    await page.waitForTimeout(800);

    const opened = await page.evaluate(() => {
      const modals = document.querySelectorAll('dialog, [class*="modal"]');
      for (const m of modals) {
        if (m.querySelector('input[type="search"]')) return true;
      }
      return false;
    });

    const shot = await snap(page, 'message-search-opened');
    if (!opened) {
      bug('LOW', 'MESSAGE_SEARCH_DEAD_CODE',
        'Search button exists but clicking it does not open SearchPanel',
        ['1. Click search button', '2. Modal with search input did not appear'],
        shot);
    } else {
      log('MESSAGE_SEARCH_WIRED: PASS — search button opens SearchPanel modal');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch (err) { log(`MESSAGE_SEARCH_WIRED: ERROR ${err.message}`); }
}

export async function testCreateSpaceFlow(page) {
  log('--- CREATE_SPACE ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1000);

    const addBtn = await page.$('[class*="sidebar"] [class*="addBtn"]');
    if (!addBtn) { log('CREATE_SPACE: SKIP (no addBtn in sidebar)'); return; }

    await addBtn.click();
    await page.waitForTimeout(1000);

    const modal = await page.$('[class*="modal"]');
    if (!modal) { log('CREATE_SPACE: SKIP (modal did not open)'); return; }

    const modalText = await modal.evaluate(el => el.textContent || '');
    if (!modalText.includes('пространство') && !modalText.includes('Space')) {
      log('CREATE_SPACE: SKIP (modal is not "create space")');
      return;
    }

    const nameInput = await page.$('[class*="modal"] input:not([type="checkbox"]):not([type="radio"])');
    if (nameInput) await nameInput.fill('QA Test Space');

    await snap(page, 'create-space-filled');

    let submitBtn = await page.$('button:has-text("Создать пространство")');
    if (!submitBtn) submitBtn = await page.$('[class*="modal"] button[type="submit"]');
    if (!submitBtn) { log('CREATE_SPACE: SKIP (no submit button)'); return; }

    await submitBtn.click();
    await page.waitForTimeout(3500);

    const shot = await snap(page, 'space-created');
    const created = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      if (!sidebar) return false;
      return (sidebar.textContent || '').includes('QA Test Space') ||
             !!sidebar.querySelector('[aria-label*="QA Test Space"]');
    });

    if (!created) {
      bug('MEDIUM', 'CREATE_SPACE_FAILED',
        'New space not visible in spaces sidebar after creation',
        ['1. Click + in spaces sidebar', '2. Fill name "QA Test Space"', '3. Submit', '4. Space missing'],
        shot);
    } else log('CREATE_SPACE: PASS');
  } catch (err) { log(`CREATE_SPACE: ERROR ${err.message}`); }
}
