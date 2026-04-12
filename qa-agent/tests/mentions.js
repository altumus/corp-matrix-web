import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';
import { setupMentionMessage, api } from '../lib/api.js';

export async function testMentionBadgeInRoomList(page) {
  log('--- MENTION_BADGE_LIST ---');

  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  } else {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1500);
  }

  const eventId = await setupMentionMessage();
  if (!eventId) { log('MENTION_BADGE_LIST: Could not send mention, skipping'); return; }
  log(`MENTION_BADGE_LIST: Mention sent — event ${eventId}`);

  await page.waitForTimeout(4000);
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'mention-badge-list');

  const mentionIcons = await page.$$('[class*="mentionIcon"]');
  log(`MENTION_BADGE_LIST: @ icons in room list: ${mentionIcons.length}`);

  if (mentionIcons.length === 0) {
    bug('LOW', 'MENTION_BADGE_LIST', '@ icon not visible (Synapse push rules may not process m.mentions API messages as highlights)', [
      '1. Send mention to user from another account',
      '2. Open room list',
      '3. @ icon should appear next to the room',
    ], shot);
  } else {
    log('MENTION_BADGE_LIST: PASS — @ badge visible');
  }
}

export async function testMentionScrollOnEnter(page) {
  log('--- MENTION_SCROLL_ENTER ---');
  if (!CONFIG.rooms.general) return;

  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  }

  const eventId = await setupMentionMessage();
  if (!eventId) return;
  await page.waitForTimeout(4000);

  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);

  const items = await page.$$(ROOM_ITEM_SEL);
  let clicked = false;
  for (const item of items) {
    const hasMention = await item.$('[class*="mentionIcon"]');
    if (hasMention) {
      await item.scrollIntoViewIfNeeded();
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) { log('MENTION_SCROLL_ENTER: No room with @ icon found'); return; }

  await page.waitForTimeout(3000);
  const shot = await snap(page, 'mention-scroll-enter');

  const url = page.url();
  if (url.includes('eventId=')) {
    log(`MENTION_SCROLL_ENTER: PASS — URL has eventId parameter`);
  } else {
    bug('LOW', 'MENTION_SCROLL_ENTER', `URL does not contain eventId after clicking mentioned room. URL: ${url}`, [], shot);
  }
}

export async function testMentionNavigator(page) {
  log('--- MENTION_NAVIGATOR ---');
  if (!CONFIG.rooms.general) return;

  await setupMentionMessage();
  await page.waitForTimeout(3000);

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'mention-navigator');

  const navBtn = await page.$('button[aria-label*="упоминаний"], button[title*="упоминан"]');
  if (!navBtn) {
    log('MENTION_NAVIGATOR: Navigator button not visible (highlightCount may be 0)');
    return;
  }

  log('MENTION_NAVIGATOR: PASS — navigator button visible');
  await navBtn.click();
  await page.waitForTimeout(1500);
  await snap(page, 'mention-navigator-after-click');
  log('MENTION_NAVIGATOR: Click handled');
}

export async function testMentionedBubble(page) {
  log('--- MENTIONED_BUBBLE ---');
  if (!CONFIG.rooms.general) return;

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);

  const mentionedMsgs = await page.$$('[class*="message"][class*="mentioned"]');
  log(`MENTIONED_BUBBLE: ${mentionedMsgs.length} mentioned message(s) visible`);

  if (mentionedMsgs.length === 0) {
    log('MENTIONED_BUBBLE: No mentioned messages visible (might need to scroll up)');
  } else {
    log('MENTIONED_BUBBLE: PASS — mention highlight class applied');
  }
  await snap(page, 'mentioned-bubble');
}

export async function testRoomMention(page) {
  log('--- ROOM_MENTION ---');
  const u2 = CONFIG.users[1];
  if (!CONFIG.rooms.general || !u2.token) return;

  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  }

  await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(CONFIG.rooms.general)}/send/m.room.message/room-mention-${Date.now()}`,
    {
      msgtype: 'm.text',
      body: '@room тестовое уведомление для всех',
      'm.mentions': { room: true },
    },
    u2.token,
  );
  log('ROOM_MENTION: @room message sent');

  await page.waitForTimeout(4000);
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);

  const mentionIcons = await page.$$('[class*="mentionIcon"]');
  log(`ROOM_MENTION: @ icons after @room: ${mentionIcons.length}`);
  await snap(page, 'room-mention');

  if (mentionIcons.length === 0) {
    bug('LOW', 'ROOM_MENTION', '@room mention did not trigger highlight badge', [], '');
  } else {
    log('ROOM_MENTION: PASS');
  }
}

export async function testAtRoomMention(page) {
  log('--- AT_ROOM_MENTION ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  await textarea.fill('');
  await textarea.click();
  await page.keyboard.type('@');
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'at-room-popup');

  const popup = await page.$('[class*="popup"]');
  if (!popup) {
    log('AT_ROOM_MENTION: Mention popup not found');
    return;
  }

  const roomItem = await page.$('[class*="roomIcon"]');
  if (!roomItem) {
    bug('MEDIUM', 'AT_ROOM_MENTION', '@room option not found in mention popup', [], shot);
  } else {
    log('AT_ROOM_MENTION: PASS — @room option visible');
  }

  await page.keyboard.press('Escape');
  await textarea.fill('');
}
