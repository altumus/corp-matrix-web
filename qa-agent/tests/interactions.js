import { log, snap, bug, safe, waitFor, ensureInRoom } from '../lib/helpers.js';

export async function testMessageBubble(page) {
  log('--- MESSAGE_BUBBLE ---');
  if (!(await ensureInRoom(page))) return;

  const messages = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  if (messages.length === 0) { log('MESSAGE_BUBBLE: No messages in timeline, skipping'); return; }

  const shot = await snap(page, 'msg-bubble-overview');
  log(`MESSAGE_BUBBLE: ${messages.length} messages visible`);

  const firstMsg = messages[0];
  const hasBubble = await firstMsg.$('[class*="bubble"]') !== null;
  const hasTime = await firstMsg.$('time, [class*="time"]') !== null;
  const hasContent = await firstMsg.$('[class*="content"]') !== null;

  log(`MESSAGE_BUBBLE: bubble=${hasBubble}, time=${hasTime}, content=${hasContent}`);
  if (!hasBubble) bug('HIGH', 'MESSAGE_BUBBLE', 'Message bubble element missing', [], shot);
  if (!hasTime) bug('MEDIUM', 'MESSAGE_BUBBLE', 'Message timestamp missing', [], shot);

  const dateSeps = await page.$$('[class*="date"]');
  log(`MESSAGE_BUBBLE: Date separators: ${dateSeps.length}`);
  const reactions = await page.$$('[class*="reactions"]');
  log(`MESSAGE_BUBBLE: Messages with reactions: ${reactions.length}`);
  const threadBadges = await page.$$('[class*="threadBadge"]');
  log(`MESSAGE_BUBBLE: Thread badges: ${threadBadges.length}`);
  const edited = await page.$$('[class*="edited"]');
  log(`MESSAGE_BUBBLE: Edited messages: ${edited.length}`);
  const receipts = await page.$$('[class*="receiptsWrap"]');
  log(`MESSAGE_BUBBLE: Read receipts: ${receipts.length}`);
}

export async function testMessageContextMenu(page) {
  log('--- MSG_CONTEXT_MENU ---');
  if (!(await ensureInRoom(page))) return;

  let msgEl = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
  if (!msgEl) msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_CONTEXT_MENU: No messages to test, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'msg-ctx-menu');

  const menu = await page.$('[class*="menu"]:not([class*="attach"])');
  if (!menu) { bug('MEDIUM', 'MSG_CONTEXT_MENU', 'Context menu not shown on right-click', [], shot); return; }

  const actionBtns = await menu.$$('button[class*="item"]');
  const actions = [];
  for (const btn of actionBtns) {
    const label = await btn.$('[class*="label"]');
    const text = label ? await label.textContent() : await btn.textContent();
    const isDanger = (await btn.getAttribute('class'))?.includes('danger') || false;
    actions.push({ text: text.trim(), danger: isDanger });
  }
  log(`MSG_CONTEXT_MENU: Actions: ${actions.map(a => a.text + (a.danger ? ' (DANGER)' : '')).join(' | ')}`);

  if (actions.length < 5) bug('MEDIUM', 'MSG_CONTEXT_MENU', `Only ${actions.length} menu actions (expected 7+)`, [], shot);

  const receiptsRow = await menu.$('[class*="receiptsRow"]');
  log(`MSG_CONTEXT_MENU: Receipts row: ${!!receiptsRow}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const menuAfter = await page.$('[class*="menu"]:not([class*="attach"])');
  if (menuAfter) bug('LOW', 'MSG_CONTEXT_MENU', 'Menu did not close on Escape', [], await snap(page, 'msg-ctx-no-close'));
  else log('MSG_CONTEXT_MENU: Closes on Escape');
}

export async function testReplyMessage(page) {
  log('--- MSG_REPLY ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_REPLY: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let replyClicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('reply') || text.toLowerCase().includes('ответ')) {
      await item.click();
      replyClicked = true;
      break;
    }
  }

  if (!replyClicked) { log('MSG_REPLY: Reply button not found in menu'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-reply-preview');

  const replyPreview = await page.$('[class*="replyPreview"]');
  if (!replyPreview) { bug('MEDIUM', 'MSG_REPLY', 'Reply preview not shown after clicking Reply', [], shot); return; }

  const cancelBtn = await page.$('[class*="replyCancelBtn"]');
  log(`MSG_REPLY: Reply preview shown, cancel btn: ${!!cancelBtn}`);

  const textarea = await page.$('textarea[class*="textarea"]');
  if (textarea) {
    const replyMsg = `Reply-test-${Date.now()}`;
    await textarea.fill(replyMsg);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await snap(page, 'msg-reply-sent');

    const replyQuote = await page.$('[class*="replyQuote"]');
    log(`MSG_REPLY: Reply quote visible: ${!!replyQuote}`);
  }
}

export async function testEditMessage(page) {
  log('--- MSG_EDIT ---');
  if (!(await ensureInRoom(page))) return;

  const ownMsg = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
  if (!ownMsg) { log('MSG_EDIT: No own messages, skipping'); return; }

  await ownMsg.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let editClicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('edit') || text.toLowerCase().includes('редакт')) {
      await item.click();
      editClicked = true;
      break;
    }
  }

  if (!editClicked) { log('MSG_EDIT: Edit action not found'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-edit-mode');

  const editPreview = await page.$('[class*="replyPreview"]');
  const textarea = await page.$('textarea[class*="textarea"]');

  if (!editPreview) bug('MEDIUM', 'MSG_EDIT', 'Edit preview not shown', [], shot);
  else log('MSG_EDIT: Edit mode activated with preview');

  if (textarea) {
    const val = await textarea.inputValue();
    log(`MSG_EDIT: Textarea pre-filled: "${val.slice(0, 50)}..."`);
    await textarea.fill(val + ' (edited)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await snap(page, 'msg-edit-saved');
    const editedBadge = await page.$('[class*="edited"]');
    log(`MSG_EDIT: Edited badge visible: ${!!editedBadge}`);
  }
}

export async function testEditCancel(page) {
  log('--- MSG_EDIT_CANCEL ---');
  if (!(await ensureInRoom(page))) return;

  const ownMsg = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
  if (!ownMsg) { log('MSG_EDIT_CANCEL: No own messages, skipping'); return; }

  await ownMsg.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('edit') || text.toLowerCase().includes('редакт')) {
      await item.click();
      break;
    }
  }

  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const editPreview = await page.$('[class*="replyPreview"]');
  if (editPreview) bug('MEDIUM', 'MSG_EDIT_CANCEL', 'Escape did not cancel edit mode', [], await snap(page, 'msg-edit-cancel-fail'));
  else log('MSG_EDIT_CANCEL: PASS — Escape cancels edit');
}

export async function testForwardMessage(page) {
  log('--- MSG_FORWARD ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_FORWARD: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('forward') || text.toLowerCase().includes('перес')) {
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) { log('MSG_FORWARD: Forward action not found in menu'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(1000);
  const shot = await snap(page, 'msg-forward-dialog');

  const dialog = await page.$('dialog, [class*="modal"]');
  if (!dialog) { bug('MEDIUM', 'MSG_FORWARD', 'Forward dialog did not open', [], shot); return; }

  const searchInput = await dialog.$('input[class*="search"]');
  const roomItems = await dialog.$$('[class*="roomItem"]');
  log(`MSG_FORWARD: Search: ${!!searchInput}, rooms: ${roomItems.length}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

export async function testForwardComplete(page) {
  log('--- FORWARD_COMPLETE ---');
  try {
    await page.waitForTimeout(1000);

    const bubble = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
    if (!bubble) { log('FORWARD_COMPLETE: SKIP — no outgoing message found'); return; }

    try { await bubble.click({ button: 'right', timeout: 5000 }); } catch (e) { log('FORWARD_COMPLETE: SKIP — right-click failed: ' + e.message); return; }
    await page.waitForTimeout(500);

    const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
    let forwardBtn = null;
    for (const item of menuItems) {
      const text = (await item.textContent() || '').toLowerCase();
      if (text.includes('перес') || text.includes('forward')) { forwardBtn = item; break; }
    }
    if (!forwardBtn) { log('FORWARD_COMPLETE: SKIP — "Forward" action not found in context menu'); await page.keyboard.press('Escape'); return; }

    await forwardBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const dialog = await page.$('dialog, [class*="modal"], [class*="forward"]');
    if (!dialog) { log('FORWARD_COMPLETE: SKIP — forward dialog did not appear'); return; }
    await snap(page, 'forward-complete-dialog');

    const searchInput = await dialog.$('input');
    if (searchInput) log('FORWARD_COMPLETE: Search input found in dialog');

    const roomItems = await dialog.$$('button[class*="room"], button[class*="item"], [class*="room"], [class*="chatItem"]');
    if (roomItems.length === 0) { log('FORWARD_COMPLETE: SKIP — no room items found in forward dialog'); await page.keyboard.press('Escape'); return; }

    await roomItems[0].click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const dialogStillOpen = await page.$('dialog, [class*="modal"][class*="forward"]');
    await snap(page, 'forward-complete-after');

    if (dialogStillOpen) {
      await bug('HIGH', 'FORWARD_COMPLETE', 'Forward did not complete — dialog still open or error',
        ['Right-click message', 'Click Forward', 'Select room in dialog', 'Dialog remains open'],
        await snap(page, 'forward-complete-bug'));
    } else {
      log('FORWARD_COMPLETE: PASS — message forwarded, dialog closed');
    }
  } catch (err) {
    log(`FORWARD_COMPLETE: ERROR ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

export async function testSelectMessages(page) {
  log('--- MSG_SELECT ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_SELECT: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('select') || text.toLowerCase().includes('выбр') || text.toLowerCase().includes('выдел')) {
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) { log('MSG_SELECT: Select action not found'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-select-mode');

  const selBar = await page.$('[class*="selectionBar"]');
  if (!selBar) { bug('MEDIUM', 'MSG_SELECT', 'Selection bar did not appear', [], shot); return; }

  const selCount = await page.$('[class*="selectionCount"]');
  if (selCount) { const count = await selCount.textContent(); log(`MSG_SELECT: Selection count: "${count.trim()}"`); }

  const selBtns = await page.$$('[class*="selectionActions"] button, [class*="selectionBtn"]');
  log(`MSG_SELECT: Selection action buttons: ${selBtns.length}`);

  const checkboxes = await page.$$('[class*="checkbox"] input[type="checkbox"]');
  log(`MSG_SELECT: Checkboxes visible: ${checkboxes.length}`);

  const allMsgs = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  if (allMsgs.length >= 2) {
    await allMsgs[1].click();
    await page.waitForTimeout(500);
    const selCount2 = await page.$('[class*="selectionCount"]');
    if (selCount2) { const count2 = await selCount2.textContent(); log(`MSG_SELECT: After selecting 2nd: "${count2.trim()}"`); }
  }

  const cancelBtn = await page.$('[class*="selectionCancel"]');
  if (cancelBtn) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
    const barGone = (await page.$('[class*="selectionBar"]')) === null;
    log(`MSG_SELECT: Selection cancelled: ${barGone}`);
  }
}

export async function testCopyMessage(page) {
  log('--- MSG_COPY ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_COPY: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if ((text.toLowerCase().includes('copy') || text.toLowerCase().includes('копир')) &&
        !text.toLowerCase().includes('link') && !text.toLowerCase().includes('ссыл')) {
      await item.click();
      clicked = true;
      break;
    }
  }

  if (clicked) log('MSG_COPY: Copy action clicked');
  else { log('MSG_COPY: Copy action not found'); await page.keyboard.press('Escape'); }
  await page.waitForTimeout(500);
}

export async function testThread(page) {
  log('--- MSG_THREAD ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_THREAD: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('thread') || text.toLowerCase().includes('тред')) {
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) { log('MSG_THREAD: Thread action not found'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(1500);
  const shot = await snap(page, 'msg-thread-panel');

  const panel = await page.$('[class*="thread"], [class*="panel"]');
  if (panel) {
    log('MSG_THREAD: Thread panel opened');
    const closeBtn = await panel.$('button[class*="close"]');
    if (closeBtn) await safe('close thread', () => closeBtn.click());
    else await page.keyboard.press('Escape');
  } else {
    log('MSG_THREAD: Thread panel element not found');
  }
  await page.waitForTimeout(500);
}

export async function testReactMessage(page) {
  log('--- MSG_REACT ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_REACT: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('react') || text.toLowerCase().includes('реакц')) {
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) { log('MSG_REACT: React action not found'); await page.keyboard.press('Escape'); return; }

  await page.waitForTimeout(1500);
  const shot = await snap(page, 'msg-react-picker');

  const picker = await page.$('em-emoji-picker, [class*="picker"], [class*="emoji"]');
  if (!picker) {
    bug('MEDIUM', 'MSG_REACT', 'Emoji picker did not appear', [], shot);
  } else {
    log('MSG_REACT: Emoji picker opened');
    const emoji = await page.$('em-emoji-picker button[data-emoji], [class*="emoji"] button');
    if (emoji) {
      await emoji.click();
      await page.waitForTimeout(2000);
      await snap(page, 'msg-react-added');
      const reaction = await page.$('[class*="reaction"]');
      log(`MSG_REACT: Reaction visible: ${!!reaction}`);
    }
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

export async function testDeleteMessage(page) {
  log('--- MSG_DELETE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (textarea) {
    const delMsg = `Delete-me-${Date.now()}`;
    await textarea.fill(delMsg);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }

  const ownMsg = await page.$('[class*="message"][class*="outgoing"]:last-child [class*="bubble"]');
  if (!ownMsg) { log('MSG_DELETE: No own message to delete, skipping'); return; }

  await ownMsg.click({ button: 'right' });
  await page.waitForTimeout(800);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let deleteBtn = null;
  for (const item of menuItems) {
    const cls = await item.getAttribute('class');
    if (cls?.includes('danger')) { deleteBtn = item; break; }
  }

  if (!deleteBtn) { log('MSG_DELETE: Delete/danger action not found'); await page.keyboard.press('Escape'); return; }

  page.once('dialog', dialog => dialog.accept());
  await deleteBtn.click();
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'msg-delete-result');

  const redacted = await page.$('[class*="redacted"]');
  log(`MSG_DELETE: Redacted message visible: ${!!redacted}`);
}

export async function testContextMenuAllActions(page) {
  log('--- CONTEXT_MENU_ALL_ACTIONS ---');
  try {
    await page.waitForTimeout(1000);

    const bubble = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
    if (!bubble) { log('CTX_MENU_ALL_ACTIONS: SKIP — no own message found'); return; }

    let actionsFound = 0;
    let actionsTested = 0;

    // --- Pin ---
    try {
      await bubble.click({ button: 'right', timeout: 5000 });
      await page.waitForTimeout(500);
      const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
      let pinBtn = null;
      for (const item of menuItems) {
        const text = (await item.textContent() || '').toLowerCase();
        if (text.includes('закреп') || text.includes('pin')) { pinBtn = item; break; }
      }
      if (pinBtn) {
        actionsFound++;
        await pinBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        const pinned = await page.$('[class*="pinned"], [class*="pinnedBar"], [class*="pin"]');
        log(`CTX_MENU_ALL_ACTIONS: Pin — ${pinned ? 'pinned indicator found' : 'no pinned indicator'}`);
        actionsTested++;
        await snap(page, 'ctx-menu-pin');
      } else {
        log('CTX_MENU_ALL_ACTIONS: Pin action not found in menu');
      }
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      log(`CTX_MENU_ALL_ACTIONS: Pin step error: ${e.message}`);
      await page.keyboard.press('Escape').catch(() => {});
    }

    // --- Copy link ---
    try {
      await bubble.click({ button: 'right', timeout: 5000 });
      await page.waitForTimeout(500);
      const menuItems2 = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
      let linkBtn = null;
      for (const item of menuItems2) {
        const text = (await item.textContent() || '').toLowerCase();
        if (text.includes('ссылк') || text.includes('copy link') || text.includes('link')) { linkBtn = item; break; }
      }
      if (linkBtn) {
        actionsFound++;
        await linkBtn.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        log('CTX_MENU_ALL_ACTIONS: Copy link — PASS (clicked)');
        actionsTested++;
      } else {
        log('CTX_MENU_ALL_ACTIONS: Copy link action not found in menu');
      }
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      log(`CTX_MENU_ALL_ACTIONS: Copy link step error: ${e.message}`);
      await page.keyboard.press('Escape').catch(() => {});
    }

    // --- Select ---
    try {
      await bubble.click({ button: 'right', timeout: 5000 });
      await page.waitForTimeout(500);
      const menuItems3 = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
      let selectBtn = null;
      for (const item of menuItems3) {
        const text = (await item.textContent() || '').toLowerCase();
        if (text.includes('выбрать') || text.includes('select')) { selectBtn = item; break; }
      }
      if (selectBtn) {
        actionsFound++;
        await selectBtn.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        const selectionUI = await page.$('[class*="selection"], [class*="selected"], [class*="checkbox"]');
        log(`CTX_MENU_ALL_ACTIONS: Select — ${selectionUI ? 'selection UI appeared' : 'no selection UI detected'}`);
        actionsTested++;
        await snap(page, 'ctx-menu-select');
        await page.keyboard.press('Escape').catch(() => {});
      } else {
        log('CTX_MENU_ALL_ACTIONS: Select action not found in menu');
      }
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      log(`CTX_MENU_ALL_ACTIONS: Select step error: ${e.message}`);
      await page.keyboard.press('Escape').catch(() => {});
    }

    log(`CTX_MENU_ALL_ACTIONS: Summary — ${actionsFound} actions found, ${actionsTested} tested`);
  } catch (err) {
    log(`CTX_MENU_ALL_ACTIONS: ERROR ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

export async function testReplyQuote(page) {
  log('--- REPLY_QUOTE ---');
  try {
    await page.waitForTimeout(1000);

    const bodyEl = await page.$('[class*="message"] [class*="bubble"] [class*="body"]');
    if (!bodyEl) { log('REPLY_QUOTE: SKIP — no message body element found'); return; }

    await bodyEl.click({ clickCount: 3 });
    await page.waitForTimeout(300);

    await bodyEl.click({ button: 'right', timeout: 5000 });
    await page.waitForTimeout(500);

    const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
    let quoteBtn = null;
    for (const item of menuItems) {
      const text = (await item.textContent() || '').toLowerCase();
      if (text.includes('цитир') || text.includes('quote') || text.includes('reply-quote')) { quoteBtn = item; break; }
    }

    if (!quoteBtn) {
      log('REPLY_QUOTE: Quote option not found in menu (may require text selection)');
      await page.keyboard.press('Escape').catch(() => {});
      return;
    }

    await quoteBtn.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    const replyPreview = await page.$('[class*="reply"], [class*="replyPreview"], [class*="quote"]');
    await snap(page, 'reply-quote');

    if (replyPreview) {
      log('REPLY_QUOTE: PASS — reply preview with quote appeared');
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      log('REPLY_QUOTE: Reply preview not detected after clicking quote');
    }
  } catch (err) {
    log(`REPLY_QUOTE: ERROR ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}
