import { log, snap, goto, ROOM_ITEM_SEL } from '../lib/helpers.js';

export async function discover(page) {
  log('═══ PHASE 1: DISCOVERY ═══');

  await goto(page, '/', 'button, input, a');
  await snap(page, 'discovery-start');
  log(`Start URL: ${page.url()}`);

  const elements = await page.evaluate(() => {
    const sel = 'button, input, textarea, select, [role="button"], [contenteditable], a[href]';
    return Array.from(document.querySelectorAll(sel)).map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      text: el.textContent?.trim().slice(0, 60),
      testId: el.getAttribute('data-testid'),
    }));
  });
  log(`Interactive elements on start page: ${elements.length}`);
  return elements;
}

export async function discoverPostAuth(page) {
  log('═══ POST-AUTH DISCOVERY ═══');
  await page.waitForTimeout(2000);
  await snap(page, 'post-auth-main');

  const roomItems = await page.$$(ROOM_ITEM_SEL);
  log(`Rooms visible: ${roomItems.length}`);

  const hasSearch = await page.$('input[type="search"]') !== null;
  log(`Search input: ${hasSearch}`);

  const hasCreate = await page.$('[class*="createBtn"], [title*="Create"]') !== null;
  log(`Create room btn: ${hasCreate}`);

  const hasSettings = await page.$('[class*="settingsBtn"], [title*="Settings"]') !== null;
  log(`Settings btn: ${hasSettings}`);

  const hasSaved = await page.$('[class*="savedBtn"], [title*="Saved"]') !== null;
  log(`Saved messages btn: ${hasSaved}`);

  // Check room list header
  const header = await page.$('[class*="header"] h1, [class*="title"]');
  if (header) {
    const text = await header.textContent();
    log(`Room list header: "${text.trim().slice(0, 50)}"`);
  }

  return { roomCount: roomItems.length, hasSearch, hasCreate, hasSettings };
}
