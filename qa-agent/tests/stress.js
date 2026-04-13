import { CONFIG, consoleErrors } from '../lib/config.js';
import { log, snap, bug, goto } from '../lib/helpers.js';
import { sendMessage } from '../lib/api.js';

export async function testStressMessages(page) {
  log('--- STRESS_MESSAGES ---');
  try {
    const user1 = CONFIG.users[0];
    const roomId = CONFIG.rooms.general;
    if (!user1?.token || !roomId) { log('STRESS_MESSAGES: SKIP (missing user/room)'); return; }

    // Clear any leftover selection mode from previous tests
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    const baselineErrors = consoleErrors.length;

    // Send 30 messages via API
    for (let i = 0; i < 30; i++) {
      await sendMessage(user1.token, roomId, `stress-msg-${i}`, `stress-${i}-${Date.now()}`);
    }

    await page.waitForTimeout(2000);

    // Navigate to general room explicitly (ensureInRoom may stay in wrong room)
    await goto(page, `/rooms/${encodeURIComponent(roomId)}`, '[class*="composer"]');
    await page.waitForTimeout(2000);

    // Scroll timeline a few times
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const tl = document.querySelector('[class*="timelineList"]');
        if (tl) tl.scrollTop = tl.scrollHeight;
      });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const tl = document.querySelector('[class*="timelineList"]');
        if (tl) tl.scrollTop = 0;
      });
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(1500);
    const shot = await snap(page, 'stress-timeline');

    const composer = await page.$('[class*="composer"]');
    const newErrors = consoleErrors.length - baselineErrors;
    log(`STRESS_MESSAGES: new console errors=${newErrors}`);

    if (!composer) {
      bug('HIGH', 'STRESS_TIMELINE_CRASH',
        'Composer not visible after stress test — timeline likely crashed',
        ['1. Send 30 messages via API', '2. Open room', '3. Scroll timeline', '4. Composer missing'],
        shot);
    } else {
      log('STRESS_MESSAGES: PASS');
    }
  } catch (err) { log(`STRESS_MESSAGES: ERROR ${err.message}`); }
}
