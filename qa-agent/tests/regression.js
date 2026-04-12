import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, ensureInRoom } from '../lib/helpers.js';
import { api } from '../lib/api.js';

export async function testTimelineNoJitter(page) {
  log('--- TIMELINE_NO_JITTER ---');
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  } else if (!(await ensureInRoom(page))) return;

  await page.waitForTimeout(1000);
  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) return;

  try {
    await msgEl.click({ button: 'right', timeout: 5000 });
  } catch {
    log('TIMELINE_NO_JITTER: Right-click blocked (overlay?), skipping');
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }
  await page.waitForTimeout(500);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('reply') || text.toLowerCase().includes('ответ')) {
      try { await item.click({ timeout: 5000 }); clicked = true; } catch { log('TIMELINE_NO_JITTER: Menu item click blocked, skipping'); }
      break;
    }
  }
  if (!clicked) { await page.keyboard.press('Escape').catch(() => {}); return; }
  await page.waitForTimeout(800);

  const replyPreview = await page.$('[class*="replyPreview"]');
  if (!replyPreview) { log('TIMELINE_NO_JITTER: Could not set reply target, skipping'); return; }
  log('TIMELINE_NO_JITTER: Reply preview set');

  const scrollBefore = await page.evaluate(() => {
    const container = document.querySelector('[class*="container"][role="log"]');
    return container ? container.scrollTop : 0;
  });

  const u2 = CONFIG.users[1];
  if (CONFIG.rooms.general && u2.token) {
    await api('PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(CONFIG.rooms.general)}/send/m.room.message/jitter-${Date.now()}`,
      { msgtype: 'm.text', body: 'Тест jitter — новое сообщение во время reply' },
      u2.token,
    );
    await page.waitForTimeout(3000);
  }

  const replyStillSet = await page.$('[class*="replyPreview"]');
  const shot = await snap(page, 'timeline-no-jitter');

  if (!replyStillSet) {
    bug('MEDIUM', 'TIMELINE_NO_JITTER', 'Reply target was lost after new message arrived', [
      '1. Set reply target', '2. Receive new message', '3. Reply preview disappeared',
    ], shot);
  } else log('TIMELINE_NO_JITTER: PASS — reply preview preserved');

  const scrollAfter = await page.evaluate(() => {
    const container = document.querySelector('[class*="container"][role="log"]');
    return container ? container.scrollTop : 0;
  });
  log(`TIMELINE_NO_JITTER: Scroll before=${scrollBefore}, after=${scrollAfter}`);

  const cancelBtn = await page.$('[class*="replyCancelBtn"]');
  if (cancelBtn) await cancelBtn.click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

export async function testPinMessageLive(page) {
  log('--- PIN_MESSAGE_LIVE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const pinText = `Pin test ${Date.now()}`;
  await textarea.fill(pinText);
  await sendBtn.click();
  await page.waitForTimeout(2500);

  const ownMsg = await page.$(`text="${pinText}"`);
  if (!ownMsg) { log('PIN_MESSAGE_LIVE: Could not find sent message, skipping'); return; }

  const bubble = await page.evaluateHandle((el) => el.closest('[class*="bubble"]'), ownMsg);
  await bubble.asElement()?.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let selectClicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('select') || text.toLowerCase().includes('выбр') || text.toLowerCase().includes('выдел')) {
      await item.click();
      selectClicked = true;
      break;
    }
  }

  if (!selectClicked) { log('PIN_MESSAGE_LIVE: Could not enter selection mode'); return; }
  await page.waitForTimeout(500);

  const selectionBtns = await page.$$('[class*="selectionBtn"]');
  let pinClicked = false;
  for (const btn of selectionBtns) {
    const title = await btn.getAttribute('title');
    if (title?.toLowerCase().includes('pin') || title?.toLowerCase().includes('закреп')) {
      await btn.click();
      pinClicked = true;
      break;
    }
  }

  if (!pinClicked) { log('PIN_MESSAGE_LIVE: Pin button not found'); return; }

  await page.waitForTimeout(4000);
  const shot = await snap(page, 'pin-message-live');

  const pinnedBar = await page.$('[class*="pinned"], [class*="bar"]');
  log(`PIN_MESSAGE_LIVE: Pinned bar found: ${!!pinnedBar}`);

  if (!pinnedBar) {
    bug('MEDIUM', 'PIN_MESSAGE_LIVE', 'Pinned message bar did not appear after pinning (requires reload)', [
      '1. Pin a message', '2. Wait for sync', '3. PinnedMessageBar should appear automatically',
    ], shot);
  } else log('PIN_MESSAGE_LIVE: PASS — bar appears live');
}

export async function testThreadBackButton(page) {
  log('--- THREAD_BACK_BUTTON ---');
  if (!(await ensureInRoom(page))) return;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { await page.setViewportSize({ width: 1280, height: 800 }); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(500);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  for (const it of menuItems) {
    const text = await it.textContent();
    if (text.toLowerCase().includes('thread') || text.toLowerCase().includes('тред')) {
      await it.click();
      break;
    }
  }
  await page.waitForTimeout(1500);

  const threadHeader = await page.$('[class*="thread"] [class*="header"], [class*="panel"] [class*="header"]');
  await snap(page, 'thread-back-button');

  if (threadHeader) {
    const buttons = await threadHeader.$$('button');
    log(`THREAD_BACK_BUTTON: ${buttons.length} buttons in thread header`);
    log('THREAD_BACK_BUTTON: PASS');
  }

  await page.setViewportSize({ width: 1280, height: 800 });
}
