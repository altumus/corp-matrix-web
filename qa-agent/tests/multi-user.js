import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, loginAs, listen, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';
import { api, sendMessage, createRoom, inviteUser } from '../lib/api.js';

export async function testMultiUser(browser) {
  log('═══ MULTI-USER TEST ═══');
  const user2 = CONFIG.users[1];

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  listen(page2, 'user2');

  const ok = await loginAs(page2, user2);
  if (!ok) {
    log('MULTI_USER: User2 login failed, skipping');
    await snap(page2, 'multi-user2-login-fail');
    await ctx2.close();
    return;
  }

  await snap(page2, 'multi-user2-rooms');
  log('MULTI_USER: User2 logged in');

  const roomItem = await page2.$(ROOM_ITEM_SEL);
  if (roomItem) {
    await roomItem.click();
    await page2.waitForTimeout(2000);
    await snap(page2, 'multi-user2-room');

    const textarea = await page2.$('textarea[class*="textarea"]');
    const sendBtn = await page2.$('button[class*="sendBtn"]');
    if (textarea && sendBtn) {
      const msg = `User2-msg-${Date.now()}`;
      await textarea.fill(msg);
      await sendBtn.click();
      await page2.waitForTimeout(2000);
      await snap(page2, 'multi-user2-sent');
      log(`MULTI_USER: User2 sent message: "${msg}"`);
    }
  }

  await ctx2.close();
}

export async function testInviteAcceptDecline(browser) {
  log('--- INVITE_ACCEPT_DECLINE ---');
  let ctx2;
  try {
    const user1 = CONFIG.users[0];
    const user2 = CONFIG.users[1];
    if (!user1?.token || !user2) { log('INVITE_ACCEPT_DECLINE: SKIP (missing users)'); return; }

    const newRoomId = await createRoom(user1.token, {
      name: `QA Invite Test ${Date.now()}`,
      preset: 'private_chat',
    });
    if (!newRoomId) { log('INVITE_ACCEPT_DECLINE: SKIP (createRoom failed)'); return; }

    await inviteUser(user1.token, newRoomId, user2.userId);
    await new Promise(r => setTimeout(r, 1500));

    try {
      const syncRes = await api('GET', '/_matrix/client/v3/sync?filter={"room":{"include_leave":false}}&timeout=0', null, user2.token);
      if (syncRes.ok && syncRes.data?.rooms?.invite) {
        for (const rid of Object.keys(syncRes.data.rooms.invite)) {
          if (rid !== newRoomId) {
            await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(rid)}/leave`, {}, user2.token);
          }
        }
      }
    } catch { /* best-effort */ }

    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    listen(page2, 'invite-user2');

    const ok = await loginAs(page2, user2);
    if (!ok) { log('INVITE_ACCEPT_DECLINE: SKIP (user2 login failed)'); await ctx2.close(); return; }

    await page2.waitForTimeout(3000);

    const inviteVisible = await page2.evaluate(() => {
      const sections = document.querySelectorAll('[class*="section"], [class*="invite"]');
      for (const s of sections) {
        const t = s.textContent || '';
        if (t.includes('Приглашени') || t.includes('QA Invite Test')) return true;
      }
      return false;
    });

    const shot1 = await snap(page2, 'invite-visible');
    if (!inviteVisible) {
      bug('HIGH', 'INVITE_NOT_VISIBLE',
        'Invite is not visible in user2 room list',
        ['1. user1 creates room via API', '2. user1 invites user2', '3. user2 logs in', '4. No invite shown'],
        shot1);
      await ctx2.close();
      return;
    }

    const acceptBtn = await page2.$('button:has-text("Принять"), button:has-text("Accept")');
    if (!acceptBtn) { log('INVITE_ACCEPT_DECLINE: no Accept button found'); await ctx2.close(); return; }

    await acceptBtn.click();
    let joined = false;
    for (let i = 0; i < 20; i++) {
      await page2.waitForTimeout(500);
      const url = page2.url();
      if (url.includes(encodeURIComponent(newRoomId)) || url.includes(newRoomId)) { joined = true; break; }
      const inDom = await page2.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) { if ((b.textContent || '').includes('QA Invite Test')) return true; }
        return false;
      });
      if (inDom) { joined = true; break; }
    }

    const shot2 = await snap(page2, 'invite-accepted');

    if (!joined) {
      bug('HIGH', 'INVITE_ACCEPT_FAILED',
        'Room did not appear in room list (or navigate) after accepting invite',
        ['1. user2 sees invite', '2. Click Accept', '3. Room missing from list and URL'],
        shot2);
    } else log('INVITE_ACCEPT_DECLINE: PASS');
  } catch (err) { log(`INVITE_ACCEPT_DECLINE: ERROR ${err.message}`); }
  finally { if (ctx2) await ctx2.close().catch(() => {}); }
}

export async function testTypingIndicatorVisual(browser, page) {
  log('--- TYPING_INDICATOR ---');
  let ctx2;
  try {
    const user2 = CONFIG.users[1];
    if (!user2) { log('TYPING_INDICATOR: SKIP (no user2)'); return; }

    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    listen(page2, 'typing-user2');

    const ok = await loginAs(page2, user2);
    if (!ok) { log('TYPING_INDICATOR: SKIP (user2 login failed)'); await ctx2.close(); return; }

    if (!(await ensureInRoom(page))) { await ctx2.close(); return; }
    if (!(await ensureInRoom(page2))) { await ctx2.close(); return; }
    await page.waitForTimeout(1000);
    await page2.waitForTimeout(1000);

    const textarea2 = await page2.$('textarea[class*="textarea"]');
    if (!textarea2) { log('TYPING_INDICATOR: SKIP (no textarea on page2)'); await ctx2.close(); return; }

    await textarea2.click();
    await page2.keyboard.type('test', { delay: 80 });

    await page.waitForTimeout(2500);

    const shot = await snap(page, 'typing-indicator');
    const hasTyping = await page.evaluate(() => {
      const indicators = document.querySelectorAll('[class*="indicator"]');
      for (const el of indicators) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('печат')) return true;
      }
      return false;
    });

    if (!hasTyping) {
      bug('MEDIUM', 'TYPING_INDICATOR',
        'No typing indicator visible on page1 while user2 types',
        ['1. user1 and user2 open same room', '2. user2 types in composer', '3. user1 sees no "печатает" indicator'],
        shot);
    } else log('TYPING_INDICATOR: PASS');

    await textarea2.fill('').catch(() => {});
  } catch (err) { log(`TYPING_INDICATOR: ERROR ${err.message}`); }
  finally { if (ctx2) await ctx2.close().catch(() => {}); }
}

export async function testReadReceiptsVisual(page) {
  log('--- READ_RECEIPTS_VISUAL ---');
  try {
    const user1 = CONFIG.users[0];
    const user2 = CONFIG.users[1];
    const roomId = CONFIG.rooms.general;

    if (!user1?.token || !user2?.token || !roomId) { log('READ_RECEIPTS_VISUAL: SKIP (missing users or room)'); return; }

    const txnId = `rr-${Date.now()}`;
    const eventId = await sendMessage(user1.token, roomId, `READ-RECEIPT-TEST-${Date.now()}`, txnId);
    if (!eventId) { log('READ_RECEIPTS_VISUAL: SKIP (send failed)'); return; }

    await page.waitForTimeout(2000);

    await api('POST',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
      {}, user2.token);

    await page.waitForTimeout(1500);

    if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const tl = document.querySelector('[class*="timelineList"]');
      if (tl) tl.scrollTop = tl.scrollHeight;
    });
    await page.waitForTimeout(1500);

    const shot = await snap(page, 'read-receipts');
    const hasReceipts = await page.evaluate(() => {
      return !!(document.querySelector('[class*="receipts"]') ||
                document.querySelector('[class*="avatarWrap"]'));
    });

    if (!hasReceipts) {
      bug('LOW', 'READ_RECEIPTS_VISUAL',
        'No visible read receipts UI after user2 marked message as read',
        ['1. user1 sends message via API', '2. user2 POST /receipt/m.read', '3. user1 UI shows no receipts'],
        shot);
    } else log('READ_RECEIPTS_VISUAL: PASS');
  } catch (err) { log(`READ_RECEIPTS_VISUAL: ERROR ${err.message}`); }
}
