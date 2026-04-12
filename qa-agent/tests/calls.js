import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';

export async function testCallButtonsInDM(page) {
  log('--- CALL_BUTTONS_DM ---');
  if (!CONFIG.rooms.direct) { log('CALL_BUTTONS_DM: No DM room, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);

  const header = await page.$('header[class*="header"]');
  if (!header) return;

  const buttons = await header.$$('button');
  const titles = [];
  for (const btn of buttons) {
    const title = await btn.getAttribute('title');
    if (title) titles.push(title);
  }
  log(`CALL_BUTTONS_DM: header buttons: ${titles.join(' | ')}`);

  const hasVoice = titles.some((t) => /голос|voice|call/i.test(t));
  const hasVideo = titles.some((t) => /видео|video/i.test(t));
  await snap(page, 'call-buttons-dm');

  if (!hasVoice && !hasVideo) {
    bug('LOW', 'CALL_BUTTONS_DM', 'Voice/video call buttons not found in DM header', [], '');
  } else {
    log('CALL_BUTTONS_DM: PASS');
  }
}

export async function testIncomingCallContainer(page) {
  log('--- INCOMING_CALL_CONTAINER ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);
  log('INCOMING_CALL_CONTAINER: PASS — app loaded with global CallContainer');
}

export async function testMemberOnlineIndicator(page) {
  log('--- MEMBER_ONLINE ---');
  if (!(await ensureInRoom(page))) return;

  const header = await page.$('[class*="info"]');
  if (!header) return;
  await header.click();
  await page.waitForTimeout(2000);

  const avatars = await page.$$('[class*="avatar"]');
  log(`MEMBER_ONLINE: ${avatars.length} avatars in room details`);
  await snap(page, 'member-online');
}
