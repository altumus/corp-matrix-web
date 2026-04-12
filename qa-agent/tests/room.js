import { CONFIG } from '../lib/config.js';
import { log, snap, bug, safe, goto, waitFor, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';

export async function testRoomHeader(page) {
  log('--- ROOM_HEADER ---');
  if (!(await ensureInRoom(page))) { log('ROOM_HEADER: Cannot enter room, skipping'); return; }

  const header = await page.$('header[class*="header"]');
  if (!header) { bug('HIGH', 'ROOM_HEADER', 'Room header not found', [], await snap(page, 'room-header-missing')); return; }

  const roomName = await header.$('[class*="name"]');
  const avatar = await header.$('[class*="avatar"]');
  const inviteBtn = await header.$('[class*="inviteBtn"], [title*="nvite"]');
  const info = await header.$('[class*="info"]');

  const nameText = roomName ? await roomName.textContent() : null;
  log(`ROOM_HEADER: name="${nameText?.trim()}", avatar=${!!avatar}, invite=${!!inviteBtn}, info=${!!info}`);

  await snap(page, 'room-header');

  if (info) {
    await info.click();
    await page.waitForTimeout(1500);
    const detailsPanel = await page.$('[class*="details"], [class*="panel"]');
    await snap(page, 'room-header-details-panel');
    log(`ROOM_HEADER: Details panel opened: ${!!detailsPanel}`);

    const panelClose = await page.$('[class*="panel"] button[class*="close"], [class*="details"] button');
    if (panelClose) await safe('close panel', () => panelClose.click());
    await page.waitForTimeout(500);
  }

  if (inviteBtn) {
    await inviteBtn.click();
    await page.waitForTimeout(1000);
    const inviteDialog = await page.$('dialog, [class*="modal"]');
    await snap(page, 'room-header-invite-dialog');
    log(`ROOM_HEADER: Invite dialog opened: ${!!inviteDialog}`);

    if (inviteDialog) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }
}

export async function testEmptyRoom(page) {
  log('--- EMPTY_ROOM ---');
  if (!CONFIG.rooms.empty) { log('EMPTY_ROOM: No empty room created, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"], [class*="empty"]');
  const shot = await snap(page, 'empty-room');

  const emptyEl = await page.$('[class*="empty"]');
  const messages = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  log(`EMPTY_ROOM: empty indicator=${!!emptyEl}, messages=${messages.length}`);

  const composer = await page.$('[class*="composer"]');
  if (!composer) {
    bug('MEDIUM', 'EMPTY_ROOM', 'Composer not shown in empty room', [], shot);
  }
}

export async function testDMRoom(page) {
  log('--- DM_ROOM ---');
  if (!CONFIG.rooms.direct) { log('DM_ROOM: No DM room created, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]');
  const shot = await snap(page, 'dm-room');

  const header = await page.$('header[class*="header"]');
  if (header) {
    const topic = await header.$('[class*="topic"]');
    if (topic) {
      const topicText = await topic.textContent();
      log(`DM_ROOM: Header subtitle: "${topicText.trim()}"`);
    }

    const onlineText = await header.$('[class*="onlineText"]');
    log(`DM_ROOM: Online indicator: ${!!onlineText}`);
  }

  const messages = await page.$$('[class*="message"]');
  log(`DM_ROOM: Messages visible: ${messages.length}`);
}

export async function testTimelineScroll(page) {
  log('--- TIMELINE_SCROLL ---');
  if (!CONFIG.rooms.general) { log('TIMELINE_SCROLL: No general room, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await snap(page, 'timeline-scroll-start');

  const initialMsgs = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  log(`TIMELINE_SCROLL: Initial messages: ${initialMsgs.length}`);

  const typingArea = await page.$('[class*="typing"]');
  log(`TIMELINE_SCROLL: Typing indicator area: ${!!typingArea}`);

  const pinnedBar = await page.$('[class*="pinned"]');
  log(`TIMELINE_SCROLL: Pinned message bar: ${!!pinnedBar}`);
}
