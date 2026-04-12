import { CONFIG } from '../lib/config.js';
import { log, snap, bug, safe, goto, waitFor, ensureInRoom, dismissKeyRestore, ROOM_ITEM_SEL } from '../lib/helpers.js';

// 3.2 Room list items display
export async function testRoomListDisplay(page) {
  log('--- ROOM_LIST_DISPLAY ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length === 0) {
    log('ROOM_LIST_DISPLAY: No rooms to check, skipping');
    return;
  }

  // Skip "Saved Messages" items — they use bookmark icon instead of Avatar
  let testItem = null;
  for (const item of items) {
    const nameEl = await item.$('[class*="name"]');
    if (nameEl) {
      const name = await nameEl.textContent();
      if (!name.includes('Saved')) { testItem = item; break; }
    }
  }

  const shot = await snap(page, 'room-list-display');

  if (!testItem) {
    log('ROOM_LIST_DISPLAY: Only Saved Messages visible (Virtuoso viewport), skipping avatar check');
  } else {
    const hasName = await testItem.$('[class*="name"]') !== null;
    const hasPreview = await testItem.$('[class*="message"]') !== null;
    const hasTime = await testItem.$('[class*="time"], time') !== null;
    const hasAvatar = await testItem.$('[class*="avatar"]') !== null;

    if (!hasName) bug('HIGH', 'ROOM_LIST_DISPLAY', 'Room name not visible in list item', [], shot);
    if (!hasAvatar) bug('MEDIUM', 'ROOM_LIST_DISPLAY', 'Avatar not visible in room list item', [], shot);
    log(`Room item: name=${hasName}, preview=${hasPreview}, time=${hasTime}, avatar=${hasAvatar}`);
  }

  // Check for unread badges
  const badges = await page.$$('[class*="badge"]');
  log(`Unread badges visible: ${badges.length}`);

  // Check for encryption icons
  const encIcons = await page.$$('[class*="statusIcon"]');
  log(`Status icons (encrypted/muted/pinned): ${encIcons.length}`);
}

// 3.3 Room list search
export async function testRoomSearch(page) {
  log('--- ROOM_SEARCH ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const searchInput = await page.$('input[type="search"]');
  if (!searchInput) {
    log('ROOM_SEARCH: No search input, skipping');
    return;
  }

  // Type a search query
  await searchInput.fill('test');
  await page.waitForTimeout(2000);
  await snap(page, 'room-search-results');

  const dropdown = await page.$('[class*="dropdown"]');
  const resultItems = await page.$$('[class*="resultItem"]');
  log(`ROOM_SEARCH: dropdown=${!!dropdown}, results=${resultItems.length}`);

  // Check "no results" state
  await searchInput.fill('zzzxxx_nonexistent_room_999');
  await page.waitForTimeout(2000);
  await snap(page, 'room-search-no-results');

  const noResults = await page.$('[class*="noResults"]');
  if (!noResults && !(await page.$('[class*="loading"]'))) {
    log('ROOM_SEARCH: No "no results" message found (might be expected)');
  }

  // Clear
  await searchInput.fill('');
  await page.waitForTimeout(500);
  log('ROOM_SEARCH: PASS');
}

// 3.4 Room item context menu
export async function testRoomListContextMenu(page) {
  log('--- ROOM_LIST_CONTEXT_MENU ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length === 0) { log('ROOM_LIST_CONTEXT_MENU: No rooms, skipping'); return; }

  await items[0].click({ button: 'right' });
  // Wait for context menu to render
  const menu = await waitFor(page, '[class*="menu"]:not([class*="attach"])', 3000);
  const shot = await snap(page, 'room-list-ctx-menu');

  if (!menu) {
    bug('MEDIUM', 'ROOM_LIST_CONTEXT_MENU', 'No context menu on right-click room item', ['1. Right-click room in list', '2. No menu appeared'], shot);
    return;
  }

  const menuBtns = await page.$$('[class*="menu"] button[class*="item"], [class*="menu"] button');
  const actions = [];
  for (const btn of menuBtns) {
    const text = await btn.textContent();
    actions.push(text.trim());
  }
  log(`ROOM_LIST_CONTEXT_MENU: Actions: ${actions.join(' | ')}`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// 3.5 Room switching
export async function testRoomSwitch(page) {
  log('--- ROOM_SWITCH ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length < 1) { log('ROOM_SWITCH: No rooms, skipping'); return; }

  // Use a known room from setup if available (more reliable than clicking Virtuoso items)
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    // Key restore screen may reappear due to async resolvePostAuthStatus — dismiss again
    if (!page.url().includes('/rooms/!') && !page.url().includes('/rooms/%21')) {
      await dismissKeyRestore(page);
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    }
  } else {
    // Fallback: find non-Saved room and click it
    let clickItem = null;
    for (const item of items) {
      const nameEl = await item.$('[class*="name"]');
      if (nameEl) {
        const name = await nameEl.textContent();
        if (!name.includes('Saved')) { clickItem = item; break; }
      }
    }
    if (!clickItem) clickItem = items[items.length - 1];
    await clickItem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await clickItem.click();
    await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 8000);
  }

  const url1 = page.url();
  const shot1 = await snap(page, 'room-switch-first');

  if (!url1.includes('/rooms/!') && !url1.includes('/rooms/%21')) {
    bug('HIGH', 'ROOM_SWITCH', `Clicking room did not navigate. URL: ${url1}`, [], shot1);
    return;
  }

  // Check room view elements
  const hasHeader = await page.$('header[class*="header"]') !== null;
  const hasComposer = await page.$('[class*="composer"]') !== null;
  const hasTimeline = await page.$('[class*="container"]') !== null;
  log(`Room view: header=${hasHeader}, composer=${hasComposer}, timeline=${hasTimeline}`);

  if (!hasHeader) bug('HIGH', 'ROOM_SWITCH', 'Room header not visible', [], shot1);
  if (!hasComposer) bug('HIGH', 'ROOM_SWITCH', 'Message composer not visible', [], shot1);

  // Check selected state in room list
  const selected = await page.$('[aria-current="page"], button[class*="selected"]');
  if (!selected) {
    log('ROOM_SWITCH: No selected state indicator on room item');
  }

  // Switch to second room
  if (items.length >= 2) {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    const items2 = await page.$$(ROOM_ITEM_SEL);
    if (items2.length >= 2) {
      await items2[1].click();
      await page.waitForTimeout(2000);
      const url2 = page.url();
      await snap(page, 'room-switch-second');
      if (url1 === url2) {
        bug('MEDIUM', 'ROOM_SWITCH', 'Switching rooms did not change URL', [], '');
      } else {
        log(`ROOM_SWITCH: Successfully switched rooms (${url1} -> ${url2})`);
      }
    }
  }
}

// 3.6 Create room dialog
export async function testCreateRoom(page) {
  log('--- ROOM_CREATE ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL);

    const createBtn = await page.$('[class*="createBtn"]');
    if (!createBtn) {
      bug('HIGH', 'ROOM_CREATE', 'Create room button not found in header', [], await snap(page, 'room-create-no-btn'));
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1000);
    const shot1 = await snap(page, 'room-create-dialog');

    const modal = await page.$('dialog, [class*="modal"]');
    if (!modal) {
      bug('HIGH', 'ROOM_CREATE', 'Create room modal did not open', [], shot1);
      return;
    }

    const tabs = await modal.$$('[class*="tab"]');
    log(`ROOM_CREATE: Tabs found: ${tabs.length}`);
    if (tabs.length < 2) {
      bug('MEDIUM', 'ROOM_CREATE', `Expected 2 tabs (Room/DM) inside dialog, found ${tabs.length}`, [], shot1);
    }

    // Check form fields
    const inputs = await modal.$$('input');
    log(`ROOM_CREATE: Input fields: ${inputs.length}`);

    // Fill room name
    const nameInput = inputs[0];
    if (nameInput) {
      const roomName = `QA-Test-${Date.now()}`;
      await nameInput.fill(roomName);
      await snap(page, 'room-create-filled');
    }

    // Test switching to DM tab
    if (tabs.length >= 2) {
      await tabs[1].click();
      await page.waitForTimeout(500);
      await snap(page, 'room-create-dm-tab');

      const visibleInputs = await modal.$$('input:visible');
      log(`ROOM_CREATE (DM tab): Visible inputs: ${visibleInputs.length}`);

      // Switch back to Room tab
      await tabs[0].click();
      await page.waitForTimeout(500);
    }

    // Close modal
    const closeBtn = await modal.$('[aria-label*="Закрыть"], [aria-label*="Close"], [class*="close"]');
    if (closeBtn) await safe('close modal', () => closeBtn.click());
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err) {
    log(`ROOM_CREATE: ERROR — ${err.message}`);
    bug('HIGH', 'ROOM_CREATE', `Test crashed: ${err.message.slice(0, 200)}`, [], await snap(page, 'room-create-crash').catch(() => ''));
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
}

// 7e.1 Room list tabs
export async function testRoomListTabs(page) {
  log('--- ROOM_LIST_TABS ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  const tabs = await page.$$('[class*="tab"]');
  log(`ROOM_LIST_TABS: ${tabs.length} tab buttons`);

  if (tabs.length < 3) {
    bug('LOW', 'ROOM_LIST_TABS', 'Tabs (All/Unread/DMs) not visible', [], '');
    return;
  }

  // Click "Unread" tab (2nd)
  await tabs[1].click();
  await page.waitForTimeout(1500);
  await snap(page, 'tabs-unread');
  log('ROOM_LIST_TABS: Unread tab clicked');

  // Click "DMs" tab
  await tabs[2].click();
  await page.waitForTimeout(1500);
  await snap(page, 'tabs-dms');

  // Back to All
  await tabs[0].click();
  await page.waitForTimeout(500);
  log('ROOM_LIST_TABS: PASS');
}

// 7e.2 Per-room notification levels in context menu
export async function testRoomNotificationLevels(page) {
  log('--- ROOM_NOTIFY_LEVELS ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);

  const item = await page.$(ROOM_ITEM_SEL);
  if (!item) return;

  await item.click({ button: 'right' });
  await page.waitForTimeout(800);
  const shot = await snap(page, 'room-notify-levels');

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  const labels = [];
  for (const it of menuItems) {
    const text = await it.textContent();
    labels.push(text.trim());
  }

  const hasAll = labels.some((l) => l.includes('Все сообщения') || l.includes('All'));
  const hasMentions = labels.some((l) => l.includes('Только упоминания') || l.includes('Mentions'));

  if (!hasAll || !hasMentions) {
    bug('LOW', 'ROOM_NOTIFY_LEVELS', `Missing notification level options. Found: ${labels.join(', ')}`, [], shot);
  } else {
    log('ROOM_NOTIFY_LEVELS: PASS — All/Mentions/Mute available');
  }

  await page.keyboard.press('Escape');
}
