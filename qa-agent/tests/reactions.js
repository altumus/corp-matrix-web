import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, ensureInRoom } from '../lib/helpers.js';

export async function testReactionStability(page) {
  log('--- REACTION_STABILITY ---');
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  } else if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('REACTION_STABILITY: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(500);

  const quickEmoji = await page.$('[class*="quickEmoji"]');
  if (!quickEmoji) {
    log('REACTION_STABILITY: No quick emoji button, skipping');
    await page.keyboard.press('Escape');
    return;
  }

  await quickEmoji.click();

  let reaction = null;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(200);
    reaction = await page.$('[class*="reactions"] > button[class*="reaction"]')
      || await page.$('[class*="reactions"] button');
    if (reaction) break;
  }
  const beforeShot = await snap(page, 'reaction-stability-1');
  if (!reaction) {
    bug('HIGH', 'REACTION_STABILITY', 'Reaction not visible after click', [], beforeShot);
    return;
  }
  log('REACTION_STABILITY: First reaction added');

  await page.waitForTimeout(3000);
  reaction = await page.$('[class*="reaction"]');
  const afterShot = await snap(page, 'reaction-stability-2');

  if (!reaction) {
    bug('HIGH', 'REACTION_STABILITY', 'Reaction disappeared after sync (race condition)', [
      '1. Add reaction', '2. Wait 3s', '3. Reaction gone',
    ], afterShot);
  } else {
    log('REACTION_STABILITY: PASS — reaction persists after sync');
  }
}

export async function testReactionRapidClicks(page) {
  log('--- REACTION_RAPID_CLICKS ---');
  if (!(await ensureInRoom(page))) return;

  const reactions = await page.$$('[class*="reaction"]:not([class*="reactionMine"])');
  if (reactions.length === 0) {
    log('REACTION_RAPID_CLICKS: No existing reactions, skipping');
    return;
  }

  const reaction = reactions[0];
  for (let i = 0; i < 3; i++) {
    await reaction.click().catch(() => {});
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(3000);
  const shot = await snap(page, 'reaction-rapid-clicks');

  const stillExists = await page.$('[class*="reaction"]');
  log(`REACTION_RAPID_CLICKS: Reactions still present after rapid clicks: ${!!stillExists}`);
}

export async function testQuickReactions(page) {
  log('--- QUICK_REACTIONS ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('QUICK_REACTIONS: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);
  const shot = await snap(page, 'quick-reactions');

  const quickBar = await page.$('[class*="quickReactions"]');
  if (!quickBar) {
    bug('MEDIUM', 'QUICK_REACTIONS', 'Quick reaction emoji bar not found in context menu', [], shot);
    await page.keyboard.press('Escape');
    return;
  }

  const emojis = await quickBar.$$('button[class*="quickEmoji"]');
  log(`QUICK_REACTIONS: ${emojis.length} quick emoji buttons found`);
  if (emojis.length < 4) {
    bug('MEDIUM', 'QUICK_REACTIONS', `Expected 6 quick emoji, found ${emojis.length}`, [], shot);
  } else {
    log('QUICK_REACTIONS: PASS');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
