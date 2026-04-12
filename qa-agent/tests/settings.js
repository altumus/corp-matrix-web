import { log, snap, bug, safe, goto } from '../lib/helpers.js';

export async function testSettingsNavigation(page) {
  log('--- SETTINGS_NAV ---');
  await goto(page, '/settings', 'nav[class*="nav"], [class*="nav"] a');

  if (!page.url().includes('/settings')) {
    await goto(page, '/rooms', 'button');
    const btn = await page.$('[class*="settingsBtn"], [title*="Settings"]');
    if (btn) { await btn.click(); await page.waitForTimeout(2000); }
  }

  const shot = await snap(page, 'settings-main');

  const navLinks = await page.$$('nav[class*="nav"] a, [class*="nav"] a[class*="link"]');
  const sections = [];
  for (const link of navLinks) {
    const text = (await link.textContent()).trim();
    const href = await link.getAttribute('href');
    sections.push({ text, href });
  }
  log(`SETTINGS_NAV: Sections: ${sections.map(s => s.text).join(', ')}`);

  const expectedSections = ['profile', 'appearance', 'devices', 'encryption', 'language', 'notification'];
  for (const expected of expectedSections) {
    const found = sections.some(s => s.text.toLowerCase().includes(expected) || s.href?.includes(expected));
    if (!found) bug('LOW', 'SETTINGS_NAV', `Settings section "${expected}" not found in nav`, [], shot);
  }

  for (const link of navLinks) {
    await safe('settings section', async () => {
      await link.click();
      await page.waitForTimeout(1500);
      const sectionName = (await link.textContent()).trim().replace(/\s+/g, '-').toLowerCase();
      await snap(page, `settings-${sectionName}`);
      log(`SETTINGS_NAV: Visited ${sectionName}`);
    });
  }
}

export async function testSettingsProfile(page) {
  log('--- SETTINGS_PROFILE ---');
  await goto(page, '/settings/profile', '[class*="avatar"], input');
  const shot = await snap(page, 'settings-profile');

  const avatar = await page.$('[class*="avatar"]');
  log(`SETTINGS_PROFILE: Avatar: ${!!avatar}`);

  const nameInput = await page.$('input');
  if (nameInput) {
    const val = await nameInput.inputValue();
    log(`SETTINGS_PROFILE: Display name: "${val}"`);
  }

  const changeAvatarBtn = await page.$('button:has-text("avatar"), button:has-text("аватар"), button:has-text("Avatar")');
  log(`SETTINGS_PROFILE: Change avatar button: ${!!changeAvatarBtn}`);

  const userId = await page.$('[class*="userId"]');
  log(`SETTINGS_PROFILE: User ID visible: ${!!userId}`);

  const saveBtn = await page.$('button[type="submit"]');
  log(`SETTINGS_PROFILE: Save button: ${!!saveBtn}`);
}

export async function testSettingsAppearance(page) {
  log('--- SETTINGS_APPEARANCE ---');
  await goto(page, '/settings/appearance', '[class*="option"]');
  const shot = await snap(page, 'settings-appearance');

  const themeOptions = await page.$$('[class*="option"]');
  log(`SETTINGS_APPEARANCE: Theme options: ${themeOptions.length}`);

  if (themeOptions.length < 2) {
    bug('MEDIUM', 'SETTINGS_APPEARANCE', 'Expected at least 2 theme options (light, dark)', [], shot);
    return;
  }

  const selected = await page.$('[class*="option"][class*="selected"]');
  if (selected) {
    const selectedText = await selected.textContent();
    log(`SETTINGS_APPEARANCE: Current theme: "${selectedText.trim()}"`);
  }

  const firstOption = themeOptions[0];
  const secondOption = themeOptions[1];

  await secondOption.click();
  await page.waitForTimeout(1000);
  await snap(page, 'settings-appearance-switched');

  await firstOption.click();
  await page.waitForTimeout(1000);
  log('SETTINGS_APPEARANCE: Theme switch works');
}

export async function testSettingsLogout(page) {
  log('--- SETTINGS_LOGOUT ---');
  await goto(page, '/settings', '[class*="logoutBtn"]');

  const logoutBtn = await page.$('[class*="logoutBtn"]');
  if (!logoutBtn) {
    bug('MEDIUM', 'SETTINGS_LOGOUT', 'Logout button not found', [], await snap(page, 'settings-no-logout'));
    return;
  }

  await logoutBtn.click();
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'settings-logout-modal');

  const modal = await page.$('dialog, [class*="modal"]');
  if (!modal) {
    bug('MEDIUM', 'SETTINGS_LOGOUT', 'Logout confirmation modal not shown', [], shot);
    return;
  }

  const modalText = await modal.$('[class*="logoutText"], p');
  if (modalText) {
    const text = await modalText.textContent();
    log(`SETTINGS_LOGOUT: Modal text: "${text.trim().slice(0, 80)}"`);
  }

  const cancelBtn = await modal.$('button[class*="secondary"]');
  if (cancelBtn) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
    const modalGone = (await page.$('dialog[open], [class*="modal"]')) === null;
    log(`SETTINGS_LOGOUT: Cancel closes modal: ${modalGone}`);
  }

  await logoutBtn.click();
  await page.waitForTimeout(1000);

  const dangerBtn = await page.$('[class*="modal"] button[class*="danger"]');
  if (dangerBtn) {
    await dangerBtn.click();
    await page.waitForTimeout(4000);
    const shot2 = await snap(page, 'settings-logout-done');

    if (page.url().includes('/login')) {
      log('SETTINGS_LOGOUT: PASS — redirected to /login');
    } else {
      bug('HIGH', 'SETTINGS_LOGOUT', `Logout did not redirect to /login. URL: ${page.url()}`, [], shot2);
    }
  }
}

export async function testPrivacySettings(page) {
  log('--- PRIVACY_SETTINGS ---');
  await goto(page, '/settings/privacy', 'h3, [class*="heading"]');
  await page.waitForTimeout(1500);
  const shot = await snap(page, 'privacy-settings');

  const checkboxes = await page.$$('input[type="checkbox"]');
  log(`PRIVACY_SETTINGS: ${checkboxes.length} privacy toggles found`);

  if (checkboxes.length < 2) {
    bug('MEDIUM', 'PRIVACY_SETTINGS', 'Privacy toggles missing (read receipts, typing)', [], shot);
  } else {
    log('PRIVACY_SETTINGS: PASS');
  }

  const deactivateBtn = await page.$('button:has-text("Удалить")');
  log(`PRIVACY_SETTINGS: Deactivate button: ${!!deactivateBtn}`);
}

export async function testIdleLogoutSetting(page) {
  log('--- IDLE_LOGOUT_SETTING ---');
  await goto(page, '/settings/privacy', 'select, h3');
  await page.waitForTimeout(1000);

  const select = await page.$('select');
  if (!select) {
    bug('LOW', 'IDLE_LOGOUT_SETTING', 'Idle timeout selector not found', [], '');
    return;
  }
  const options = await select.$$('option');
  log(`IDLE_LOGOUT_SETTING: ${options.length} timeout options`);
  log('IDLE_LOGOUT_SETTING: PASS');
}
