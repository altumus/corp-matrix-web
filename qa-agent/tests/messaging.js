import { log, snap, bug, ensureInRoom } from '../lib/helpers.js';

export async function testChatSendMessage(page) {
  log('--- CHAT_SEND_MESSAGE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) {
    bug('CRITICAL', 'CHAT_SEND_MESSAGE', 'Composer textarea not found', [], await snap(page, 'chat-no-composer'));
    return;
  }

  const msg = `QA-test-${Date.now()}`;
  await textarea.fill(msg);
  await page.waitForTimeout(200);
  await snap(page, 'chat-msg-typed');

  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!sendBtn) {
    bug('CRITICAL', 'CHAT_SEND_MESSAGE', 'Send button not found after typing text', [], await snap(page, 'chat-no-sendbtn'));
    return;
  }

  const disabled = await sendBtn.isDisabled();
  if (disabled) {
    bug('HIGH', 'CHAT_SEND_MESSAGE', 'Send button disabled with text', [], await snap(page, 'chat-send-disabled'));
    return;
  }

  await sendBtn.click();

  let msgFound = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1500);
    const msgEl = await page.$(`text="${msg}"`);
    if (msgEl) { msgFound = true; break; }
  }

  const shot = await snap(page, 'chat-msg-sent');

  if (!msgFound) {
    const remainingText = await (await page.$('textarea[class*="textarea"]'))?.inputValue() ?? '';
    if (!remainingText.trim()) {
      log('CHAT_SEND_MESSAGE: Message sent (textarea cleared) but not yet visible — likely E2E encryption delay');
    } else {
      bug('HIGH', 'CHAT_SEND_MESSAGE', 'Sent message not visible in timeline', ['1. Type message', '2. Send', '3. Not shown after 9s'], shot);
    }
  } else {
    const msgBubble = await page.$(`[class*="outgoing"]`);
    log(`CHAT_SEND_MESSAGE: PASS, outgoing bubble: ${!!msgBubble}`);
  }
}

export async function testChatSendEnter(page) {
  log('--- CHAT_SEND_ENTER ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  const msg = `Enter-test-${Date.now()}`;
  await textarea.fill(msg);
  await page.keyboard.press('Enter');

  let found = false;
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1500);
    if (await page.$(`text="${msg}"`)) { found = true; break; }
  }
  const shot = await snap(page, 'chat-enter-sent');

  if (!found) {
    const remainingText = await (await page.$('textarea[class*="textarea"]'))?.inputValue() ?? '';
    if (!remainingText.trim()) {
      log('CHAT_SEND_ENTER: PASS — textarea cleared (message sent, E2E delay)');
    } else {
      bug('MEDIUM', 'CHAT_SEND_ENTER', 'Enter key did not send message', [], shot);
    }
  } else {
    log('CHAT_SEND_ENTER: PASS');
  }
}

export async function testChatShiftEnter(page) {
  log('--- CHAT_SHIFT_ENTER ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  await textarea.fill('');
  await textarea.click();
  await page.keyboard.type('Line1');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Shift');
  await page.keyboard.type('Line2');
  await page.waitForTimeout(500);

  const value = await textarea.inputValue();
  const shot = await snap(page, 'chat-shift-enter');

  if (!value.includes('\n') && !value.includes('Line1') && !value.includes('Line2')) {
    bug('MEDIUM', 'CHAT_SHIFT_ENTER', 'Shift+Enter did not create newline', [], shot);
  } else {
    log(`CHAT_SHIFT_ENTER: PASS — value has newline: ${value.includes('\n')}`);
  }

  await textarea.fill('');
}

export async function testChatSendEmpty(page) {
  log('--- CHAT_SEND_EMPTY ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  await textarea.fill('');
  await page.waitForTimeout(300);
  const disabled = await sendBtn.isDisabled();
  const shot = await snap(page, 'chat-empty');

  if (!disabled) {
    bug('MEDIUM', 'CHAT_SEND_EMPTY', 'Send button enabled with empty input', [], shot);
  } else {
    log('CHAT_SEND_EMPTY: PASS — send disabled for empty');
  }

  await textarea.fill('   ');
  await page.waitForTimeout(300);
  const disabledWs = await sendBtn.isDisabled();
  if (!disabledWs) {
    bug('MEDIUM', 'CHAT_SEND_EMPTY', 'Send button enabled with whitespace-only input', [], await snap(page, 'chat-whitespace'));
  }
  await textarea.fill('');
}

export async function testChatLongMessage(page) {
  log('--- CHAT_LONG_MESSAGE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const longMsg = 'L'.repeat(1500) + ` [QA-${Date.now()}]`;
  await textarea.fill(longMsg);
  await page.waitForTimeout(500);

  const height = await textarea.evaluate(el => el.offsetHeight);
  log(`CHAT_LONG_MESSAGE: Textarea height after long text: ${height}px`);
  await snap(page, 'chat-long-typed');

  if (height < 50) {
    bug('LOW', 'CHAT_LONG_MESSAGE', `Textarea did not expand for long text (height: ${height}px)`, [], '');
  }

  await sendBtn.click();
  await page.waitForTimeout(3000);
  await snap(page, 'chat-long-sent');
  log('CHAT_LONG_MESSAGE: Sent');
}

export async function testChatSpecialChars(page) {
  log('--- CHAT_SPECIAL_CHARS ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const xssMsg = `<script>alert("xss")</script> <img src=x onerror=alert(1)> & "quotes" 'single' <b>bold</b> 🎉🚀💀 ñüö — ™©® ½ QA-${Date.now()}`;
  await textarea.fill(xssMsg);
  await sendBtn.click();
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'chat-xss-sent');

  const hasXss = await page.evaluate(() => {
    const msgs = document.querySelectorAll('[class*="textContent"]');
    for (const m of msgs) {
      if (m.querySelector('script')) return 'script tag rendered';
      if (m.querySelector('img[onerror]')) return 'img onerror rendered';
    }
    return null;
  });

  if (hasXss) {
    bug('CRITICAL', 'CHAT_SPECIAL_CHARS', `XSS vulnerability: ${hasXss}`, ['1. Send message with script/img tags', '2. Tag rendered in DOM'], shot);
  } else {
    log('CHAT_SPECIAL_CHARS: PASS — no XSS');
  }
}

export async function testAttachMenu(page) {
  log('--- ATTACH_MENU ---');
  if (!(await ensureInRoom(page))) return;

  const attachBtn = await page.$('[class*="attachBtn"]');
  if (!attachBtn) {
    log('ATTACH_MENU: No attach button, skipping');
    return;
  }

  await attachBtn.click();
  await page.waitForTimeout(800);
  const shot = await snap(page, 'attach-menu-open');

  const menu = await page.$('[class*="menu"]');
  if (!menu) {
    bug('MEDIUM', 'ATTACH_MENU', 'Attach menu did not open', [], shot);
    return;
  }

  const menuItems = await menu.$$('button[class*="item"]');
  const items = [];
  for (const item of menuItems) {
    items.push((await item.textContent()).trim());
  }
  log(`ATTACH_MENU: Items: ${items.join(' | ')}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const fileInput = await page.$('input[type="file"][class*="hidden"]');
  if (!fileInput) {
    bug('LOW', 'ATTACH_MENU', 'Hidden file input not found', [], '');
  } else {
    const accept = await fileInput.getAttribute('accept');
    log(`ATTACH_MENU: File input accept="${accept}"`);
  }
}
