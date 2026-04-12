import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto, loginAs } from '../lib/helpers.js';

// 2.1 Empty form submission
export async function testAuthEmpty(page) {
  log('--- AUTH_EMPTY ---');
  await goto(page, '/login', 'button[type="submit"]');

  const btn = await page.$('button[type="submit"]');
  if (!btn) { bug('CRITICAL', 'AUTH_EMPTY', 'Submit button not found on login', [], await snap(page, 'auth-empty-no-btn')); return; }

  await btn.click();
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'auth-empty-submitted');

  const hasHtml5 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[required]')).some(i => !i.validity.valid);
  });
  const hasCustomErr = await page.$('[role="alert"], [class*="error"]');

  if (!hasHtml5 && !hasCustomErr) {
    bug('MEDIUM', 'AUTH_EMPTY', 'No validation on empty login form submission', ['1. Open /login', '2. Click Submit empty', '3. No validation shown'], shot);
  } else {
    log('AUTH_EMPTY: PASS — validation works');
  }
}

// 2.2 Wrong credentials
export async function testAuthWrongCreds(page) {
  log('--- AUTH_WRONG_CREDS ---');
  await goto(page, '/login', 'button[type="submit"]');

  const hs = await page.$('input[autocomplete="url"]');
  if (hs) { await hs.fill(''); await hs.fill(CONFIG.homeserver); }

  const u = await page.$('input[autocomplete="username"]');
  const p = await page.$('input[type="password"]');
  if (!u || !p) { bug('CRITICAL', 'AUTH_WRONG_CREDS', 'Login inputs not found', [], await snap(page, 'auth-wrong-no-input')); return; }

  await u.fill('nonexistent_user_xyz');
  await p.fill('wrongpassword999');
  await snap(page, 'auth-wrong-filled');

  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();
  await page.waitForTimeout(4000);
  const shot = await snap(page, 'auth-wrong-result');

  const errEl = await page.$('[class*="error"]');
  if (!errEl) {
    bug('HIGH', 'AUTH_WRONG_CREDS', 'No error for invalid credentials', ['1. Enter wrong username/password', '2. Submit', '3. No error shown'], shot);
  } else {
    const errText = await errEl.textContent();
    log(`AUTH_WRONG_CREDS: PASS — error: "${errText.trim()}"`);
  }
}

// 2.3 Valid login
export async function testAuthLogin(page) {
  log('--- AUTH_LOGIN ---');
  const user = CONFIG.users[0];
  const ok = await loginAs(page, user);
  const shot = await snap(page, ok ? 'auth-login-ok' : 'auth-login-fail');

  if (!ok) {
    const errEl = await page.$('[class*="error"]');
    const errTxt = errEl ? await errEl.textContent() : 'unknown';
    bug('CRITICAL', 'AUTH_LOGIN', `Login failed: ${errTxt}`, ['1. Enter valid creds', '2. Submit', '3. Did not navigate to /rooms'], shot);
  } else {
    log('AUTH_LOGIN: PASS');
  }
  return ok;
}

// 2.4 Registration page
export async function testRegisterPage(page) {
  log('--- REGISTER_PAGE ---');
  await goto(page, '/register', 'button[type="submit"]');
  const shot = await snap(page, 'register-page');

  // Check all fields exist
  const fields = await page.$$('input');
  const fieldCount = fields.length;
  log(`Register page has ${fieldCount} input fields`);

  if (fieldCount < 3) {
    bug('HIGH', 'REGISTER_PAGE', `Expected >=3 fields (homeserver, username, password, confirm), found ${fieldCount}`, [], shot);
  }

  // Check heading
  const heading = await page.$('h2[class*="heading"]');
  if (!heading) {
    bug('LOW', 'REGISTER_PAGE', 'No heading found on register page', [], shot);
  }

  // Check link to login
  const loginLink = await page.$('a[href*="login"]');
  if (!loginLink) {
    bug('MEDIUM', 'REGISTER_PAGE', 'No link to login page from register', [], shot);
  } else {
    log('REGISTER_PAGE: Login link present');
  }
}

// 2.5 Register password mismatch
export async function testRegisterMismatch(page) {
  log('--- REGISTER_MISMATCH ---');
  await goto(page, '/register', 'button[type="submit"]');

  const hs = await page.$('input[autocomplete="url"]');
  if (hs) { await hs.fill(''); await hs.fill(CONFIG.homeserver); }

  const u = await page.$('input[autocomplete="username"]');
  const pwFields = await page.$$('input[type="password"]');

  if (!u || pwFields.length < 2) {
    log('REGISTER_MISMATCH: Cannot find all fields, skipping');
    return;
  }

  await u.fill('testmismatch');
  await pwFields[0].fill('password123');
  await pwFields[1].fill('differentpassword');

  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();
  await page.waitForTimeout(1500);
  const shot = await snap(page, 'register-mismatch');

  const errEl = await page.$('[class*="error"]');
  if (!errEl) {
    bug('MEDIUM', 'REGISTER_MISMATCH', 'No error shown for password mismatch', ['1. Enter mismatched passwords', '2. Submit', '3. No error'], shot);
  } else {
    log('REGISTER_MISMATCH: PASS — error shown for mismatch');
  }
}
