import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, loginAs, ensureInRoom, ROOM_ITEM_SEL } from '../lib/helpers.js';

export async function testResponsive(page, viewport, label) {
  log(`--- RESPONSIVE_${label.toUpperCase()} ---`);
  const user = CONFIG.users[0];

  await page.setViewportSize(viewport);
  const ok = await loginAs(page, user);
  if (!ok) {
    log(`RESPONSIVE_${label}: Login failed, taking screenshot`);
    await snap(page, `resp-${label}-login-fail`);
    await page.setViewportSize({ width: 1280, height: 800 });
    return;
  }

  await snap(page, `resp-${label}-rooms`);

  const overflowX = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  if (overflowX) {
    bug('MEDIUM', `RESPONSIVE_${label.toUpperCase()}`, `Horizontal overflow at ${viewport.width}x${viewport.height}`, [], await snap(page, `resp-${label}-overflow`));
  }

  const tinyBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const tiny = [];
    for (const btn of btns) {
      const r = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && btn.offsetParent !== null && (r.width < 24 || r.height < 24)) {
        tiny.push(`"${btn.textContent?.trim().slice(0, 20)}" (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return tiny.slice(0, 5);
  });
  if (tinyBtns.length > 0) {
    bug('LOW', `RESPONSIVE_${label.toUpperCase()}`, `Small buttons: ${tinyBtns.join(', ')}`, [], '');
  }

  const roomItem = await page.$(ROOM_ITEM_SEL);
  if (roomItem) {
    await roomItem.click();
    await page.waitForTimeout(2000);
    await snap(page, `resp-${label}-room`);

    const backBtn = await page.$('[class*="backBtn"]');
    log(`RESPONSIVE_${label}: Back button in room: ${!!backBtn}`);

    const composer = await page.$('[class*="composer"]');
    log(`RESPONSIVE_${label}: Composer visible: ${!!composer}`);
  }

  await goto(page, '/settings', 'nav, [class*="nav"]');
  await snap(page, `resp-${label}-settings`);

  await page.setViewportSize({ width: 1280, height: 800 });
}

export async function testTouchTargetSize(page) {
  log('--- TOUCH_TARGETS ---');
  await page.setViewportSize({ width: 375, height: 812 });
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  const tiny = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const tooSmall = [];
    for (const btn of Array.from(buttons)) {
      if (btn.offsetParent === null) continue;
      const r = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 36 || r.height < 36)) {
        tooSmall.push(`${btn.textContent?.trim().slice(0, 20)} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return tooSmall.slice(0, 5);
  });

  await snap(page, 'touch-targets');
  await page.setViewportSize({ width: 1280, height: 800 });

  if (tiny.length > 0) {
    bug('LOW', 'TOUCH_TARGETS', `Buttons too small for mobile: ${tiny.join(', ')}`, [], '');
  } else {
    log('TOUCH_TARGETS: PASS');
  }
}

export async function testHighContrastMode(page) {
  log('--- HIGH_CONTRAST_CSS ---');
  const found = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-contrast')) {
            return true;
          }
        }
      } catch { /* CORS */ }
    }
    return false;
  });

  if (found) log('HIGH_CONTRAST_CSS: PASS — @media (prefers-contrast) detected');
  else log('HIGH_CONTRAST_CSS: not found in active stylesheets (may not be applied)');
}

export async function testSwipeReply(page) {
  log('--- SWIPE_REPLY ---');
  if (!(await ensureInRoom(page))) return;

  const bubble = await page.$('[class*="message"] [class*="bubble"]');
  if (!bubble) { log('SWIPE_REPLY: No message, skipping'); return; }

  const box = await bubble.boundingBox();
  if (!box) return;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  try {
    await page.touchscreen.tap(box.x + 10, box.y + box.height / 2);
    await bubble.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const startX = rect.left + 10;
      const startY = rect.top + rect.height / 2;
      const touch1 = new Touch({ identifier: 1, target: el, clientX: startX, clientY: startY });
      const touch2 = new Touch({ identifier: 1, target: el, clientX: startX + 80, clientY: startY });

      el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch1], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchmove', { touches: [touch2], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
    });
    await page.waitForTimeout(1000);
  } catch (err) {
    log(`SWIPE_REPLY: Touch simulation failed: ${err.message}`);
  }

  const replyPreview = await page.$('[class*="replyPreview"]');
  await snap(page, 'swipe-reply');

  if (replyPreview) {
    log('SWIPE_REPLY: PASS — reply preview shown after swipe');
    const cancelBtn = await page.$('[class*="replyCancelBtn"]');
    if (cancelBtn) await cancelBtn.click();
  } else {
    log('SWIPE_REPLY: Reply preview not shown (touch event may not work in headless)');
  }

  await page.setViewportSize({ width: 1280, height: 800 });
}

export async function testMobileLongPress(page) {
  log('--- MOBILE_LONG_PRESS ---');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);

    const bubble = await page.$('[class*="message"] [class*="bubble"]');
    if (!bubble) {
      log('MOBILE_LONG_PRESS: SKIP — no message bubble found');
      await page.setViewportSize({ width: 1280, height: 800 });
      return;
    }

    const box = await bubble.boundingBox();
    if (!box) {
      log('MOBILE_LONG_PRESS: SKIP — bubble has no bounding box');
      await page.setViewportSize({ width: 1280, height: 800 });
      return;
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(200);

    await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
        bubbles: true
      }));
    }, { x, y });
    await page.waitForTimeout(600);
    await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    }, { x, y });

    await page.waitForTimeout(1000);
    await snap(page, 'mobile-long-press');

    const menu = await page.$('[class*="menu"] button[class*="item"], [class*="contextMenu"], [class*="popup"] button');
    if (menu) {
      log('MOBILE_LONG_PRESS: PASS — context menu appeared');
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      log('MOBILE_LONG_PRESS: Context menu did not appear (touch events may not trigger in Playwright)');
    }

    await page.setViewportSize({ width: 1280, height: 800 });
  } catch (err) {
    log(`MOBILE_LONG_PRESS: ERROR ${err.message}`);
    await page.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
  }
}
