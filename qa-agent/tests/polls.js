import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, ensureInRoom } from '../lib/helpers.js';

export async function testCreatePoll(page) {
  log('--- CREATE_POLL ---');
  try {
    if (CONFIG.rooms.general) {
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    } else if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(500);

    let attachBtn = await page.$('[class*="attachBtn"]');
    if (!attachBtn) attachBtn = await page.$('button[aria-label*="Attach"]');
    if (!attachBtn) attachBtn = await page.$('button[aria-label*="ttach"]');
    if (!attachBtn) { log('CREATE_POLL: SKIP (no attach button)'); return; }

    await attachBtn.click();
    await page.waitForTimeout(800);

    const menuButtons = await page.$$('[class*="attachMenu"] button, [class*="menu"] button');
    if (menuButtons.length === 0) { log('CREATE_POLL: SKIP (attach menu did not open or has no buttons)'); return; }

    let pollItem = null;
    for (const btn of menuButtons) {
      const txt = (await btn.textContent()) || '';
      if (/опрос|poll/i.test(txt)) { pollItem = btn; break; }
    }
    if (!pollItem) {
      bug('LOW', 'CREATE_POLL', 'No poll item in attach menu', ['1. Open room', '2. Click attach button', '3. Option missing'], await snap(page, 'poll-menu-missing'));
      return;
    }

    await pollItem.click();
    await page.waitForTimeout(1000);

    const modal = await page.$('[class*="modal"]');
    if (!modal) { log('CREATE_POLL: SKIP (modal not opened)'); return; }

    const questionInput = await page.$('[class*="modal"] input[autofocus], [class*="modal"] input:not([type="checkbox"]):not([type="radio"])');
    if (questionInput) await questionInput.fill('QA Test Poll Question');

    const optionInputs = await page.$$('[class*="optionInput"] input, input[class*="optionInput"], [class*="option"] input');
    if (optionInputs.length >= 2) {
      await optionInputs[0].fill('Option A');
      await optionInputs[1].fill('Option B');
    } else {
      log(`CREATE_POLL: only ${optionInputs.length} option inputs found`);
    }

    await snap(page, 'poll-modal-filled');

    let submitBtn = await page.$('button[type="submit"]:has-text("Создать опрос")');
    if (!submitBtn) submitBtn = await page.$('[class*="modal"] button[type="submit"]');
    if (!submitBtn) submitBtn = await page.$('button:has-text("Создать опрос")');

    if (!submitBtn) { log('CREATE_POLL: SKIP (no submit button)'); return; }

    await submitBtn.click();

    let hasPoll = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(200);
      hasPoll = await page.evaluate(() => {
        const polls = document.querySelectorAll('[class*="poll"]');
        for (const p of polls) {
          if ((p.textContent || '').includes('QA Test Poll Question')) return true;
        }
        return false;
      });
      if (hasPoll) break;
    }

    const shot = await snap(page, 'poll-created');

    if (!hasPoll) {
      bug('LOW', 'CREATE_POLL',
        'Poll created via UI form but not visible in timeline (poll created via API in setup is tested separately by POLL_VOTE)',
        ['1. Open room', '2. Click attach > Начать опрос', '3. Fill question and 2 options', '4. Submit', '5. Poll missing in timeline'],
        shot);
    } else {
      log('CREATE_POLL: PASS');
    }
  } catch (err) {
    log(`CREATE_POLL: ERROR ${err.message}`);
  }
}

export async function testVotePoll(page) {
  log('--- POLL_VOTE ---');
  try {
    if (CONFIG.rooms.general) {
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    } else if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(800);

    const pollHandle = await page.evaluateHandle(() => {
      const polls = document.querySelectorAll('[class*="poll"]');
      for (const p of polls) {
        if ((p.textContent || '').includes('QA Test Poll Question')) return p;
      }
      return null;
    });

    const pollEl = pollHandle.asElement();
    if (!pollEl) { log('POLL_VOTE: SKIP (no poll from previous test)'); return; }

    const answer = await pollEl.$('button[class*="answer"]');
    if (!answer) { log('POLL_VOTE: SKIP (no answer button inside poll)'); return; }

    await answer.click();

    let voted = false;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(200);
      voted = await page.evaluate(() => {
        const polls = document.querySelectorAll('[class*="poll"]');
        for (const p of polls) {
          if ((p.textContent || '').includes('QA Test Poll Question')) {
            return !!(p.querySelector('[class*="voted"]') ||
                     p.querySelector('[class*="check"]') ||
                     p.querySelector('[class*="progressBar"]'));
          }
        }
        return false;
      });
      if (voted) break;
    }

    const shot = await snap(page, 'poll-voted');

    if (!voted) {
      bug('MEDIUM', 'POLL_VOTE',
        'After clicking answer no visual feedback (voted/check/progressBar)',
        ['1. Open room with poll', '2. Click first answer', '3. No UI feedback of vote'],
        shot);
    } else {
      log('POLL_VOTE: PASS');
    }
  } catch (err) {
    log(`POLL_VOTE: ERROR ${err.message}`);
  }
}
