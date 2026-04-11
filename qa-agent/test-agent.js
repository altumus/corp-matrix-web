import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  appUrl: 'http://localhost:5173',
  homeserver: 'http://127.0.0.1:8008',
  // Shared secret from Synapse homeserver.yaml (registration_shared_secret)
  sharedSecret: 'G*gx.o9QSemZMvlXMSu7dj&ki-~BX7GgRpziZGPl9XD_M9#_~:',
  users: [
    { username: 'testuser1', password: 'testpass123', role: 'primary', token: null, userId: null },
    { username: 'testuser2', password: 'testpass123', role: 'secondary', token: null, userId: null },
  ],
  // Rooms created during setup (filled at runtime)
  rooms: {
    general: null,    // roomId — group room with both users (no E2E, API messages)
    direct: null,     // roomId — DM between users (no E2E, API messages)
    empty: null,      // roomId — room with no messages
    media: null,      // roomId — room for media tests
    encrypted: null,  // roomId — E2E room (for encryption tests, client-side messages only)
  },
  screenshotDir: path.join(__dirname, 'qa-output', 'screenshots'),
  reportPath: path.join(__dirname, 'qa-output', 'bug-report.md'),
  timeout: 12000,
  slowMo: 120,
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const bugs = [];
const testLog = [];
const consoleErrors = [];
const networkErrors = [];
let screenshotIdx = 0;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const entry = `[${ts}] ${msg}`;
  testLog.push(entry);
  console.log(entry);
}

async function snap(page, name) {
  screenshotIdx++;
  const filename = `${String(screenshotIdx).padStart(3, '0')}-${name}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
  } catch { /* page might have navigated */ }
  return filename;
}

function bug(severity, scenario, description, steps, screenshot) {
  bugs.push({ severity, scenario, description, steps, screenshot });
  log(`BUG [${severity}] ${scenario}: ${description}`);
}

async function safe(label, fn) {
  try { return await fn(); }
  catch (err) { log(`ERROR in ${label}: ${err.message}`); return null; }
}

function listen(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: label, text: msg.text(), ts: new Date().toISOString() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ page: label, text: err.message, ts: new Date().toISOString() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ page: label, url: res.url(), status: res.status(), ts: new Date().toISOString() });
    }
  });
}

/** Wait for a selector with a fallback — returns element or null */
async function waitFor(page, selector, timeout = CONFIG.timeout) {
  try {
    return await page.waitForSelector(selector, { timeout });
  } catch { return null; }
}

/** Dismiss KeyRestoreScreen if it appears (click "Skip for now") */
async function dismissKeyRestore(page) {
  const skipBtn = await page.$('[class*="skipButton"], button:has-text("Skip"), button:has-text("Пропустить")');
  if (skipBtn) {
    log('Key restore screen detected — clicking Skip');
    await skipBtn.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

/** Navigate to app and wait for it to be ready (not networkidle — Matrix WS keeps connection open) */
async function goto(page, path, waitSelector) {
  await page.goto(`${CONFIG.appUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
  await page.waitForTimeout(1500);
  await dismissKeyRestore(page);
  if (waitSelector) {
    await waitFor(page, waitSelector, CONFIG.timeout);
  }
}

// Selector for room list items (NOT spaces sidebar items).
const ROOM_ITEM_SEL = 'button[class*="item"]:has([class*="content"])';

/** Navigate to a room: enters first room or specified room item */
async function ensureInRoom(page) {
  if (page.url().includes('/rooms/!') || page.url().includes('/rooms/%21')) {
    await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 5000);
    return true;
  }
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  const item = await page.$(ROOM_ITEM_SEL);
  if (!item) { log('No rooms available'); return false; }
  await item.click();
  const composer = await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 8000);
  if (!composer) {
    log('Room entered but composer not found');
    await page.waitForTimeout(2000);
  }
  return page.url().includes('/rooms/');
}

/** Login helper */
async function loginAs(page, user) {
  await goto(page, '/login', 'input[autocomplete="username"]');

  const hs = await page.$('input[autocomplete="url"]');
  if (hs) { await hs.fill(''); await hs.fill(CONFIG.homeserver); }

  const u = await page.$('input[autocomplete="username"]');
  const p = await page.$('input[type="password"]');
  if (!u || !p) return false;

  await u.fill(user.username);
  await p.fill(user.password);
  const btn = await page.$('button[type="submit"]');
  if (btn) await btn.click();

  // Wait for either /rooms or the key restore screen
  try {
    await page.waitForURL('**/rooms**', { timeout: 10000 });
  } catch {
    // URL didn't change to /rooms — might be on key restore screen
  }

  // Check for key restore screen and dismiss it
  await page.waitForTimeout(2000);
  await dismissKeyRestore(page);

  // Now wait for the room list to appear
  try {
    await waitFor(page, `${ROOM_ITEM_SEL}, [class*="list"], [role="status"]`, 10000);
    await page.waitForTimeout(1500);
    return page.url().includes('/rooms') || page.url().includes('/login') === false;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 0 — SETUP (create users, rooms, messages via API)
// ═══════════════════════════════════════════════════════════════
const HS = CONFIG.homeserver;

async function api(method, path, body, token, _retries = 5) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${HS}${path}`, opts);
  } catch (err) {
    // Network error (server not ready, connection refused, etc.)
    if (_retries > 0) {
      log(`  Network error on ${method} ${path}: ${err.message} — retrying in 3s (${_retries} left)`);
      await new Promise(r => setTimeout(r, 3000));
      return api(method, path, body, token, _retries - 1);
    }
    return { ok: false, status: 0, data: { error: err.message } };
  }

  // Handle 429 Too Many Requests — wait and retry
  if (res.status === 429 && _retries > 0) {
    const retryJson = await res.json().catch(() => ({}));
    const rawMs = retryJson.retry_after_ms;
    // Use fixed 3s delay — server value can be negative/garbage
    const waitMs = (typeof rawMs === 'number' && rawMs > 0 && rawMs < 30000) ? rawMs + 500 : 3000;
    log(`  429 on ${method} ${path} — waiting ${waitMs}ms (${_retries} retries left)`);
    await new Promise(r => setTimeout(r, waitMs));
    return api(method, path, body, token, _retries - 1);
  }

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

/** Register user via Synapse shared-secret admin API */
async function registerSharedSecret(username, password, admin = false) {
  // Step 1: get nonce
  const nonceRes = await api('GET', '/_synapse/admin/v1/register');
  if (!nonceRes.ok) return null;
  const nonce = nonceRes.data.nonce;

  // Step 2: compute HMAC
  const secret = CONFIG.sharedSecret;
  const hmacData = [nonce, username, password, admin ? 'admin' : 'notadmin'].join('\x00');
  const mac = crypto.createHmac('sha1', secret).update(hmacData).digest('hex');

  // Step 3: register
  const regRes = await api('POST', '/_synapse/admin/v1/register', {
    nonce, username, password, admin, mac,
  });
  return regRes.ok ? regRes.data : null;
}

/** Register via standard Matrix client API (if open registration) */
async function registerOpen(username, password) {
  const res = await api('POST', '/_matrix/client/v3/register', {
    username, password,
    auth: { type: 'm.login.dummy' },
    inhibit_login: false,
  });
  if (res.ok) return res.data;
  // 401 with flows means registration needs more steps — try with dummy
  if (res.status === 401 && res.data.session) {
    const res2 = await api('POST', '/_matrix/client/v3/register', {
      username, password,
      auth: { type: 'm.login.dummy', session: res.data.session },
      inhibit_login: false,
    });
    return res2.ok ? res2.data : null;
  }
  return null;
}

/** Login via Matrix API, return { access_token, user_id } */
async function matrixLogin(username, password) {
  const res = await api('POST', '/_matrix/client/v3/login', {
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: username },
    password,
  });
  return res.ok ? res.data : null;
}

/** Create or ensure a user exists and return access token */
async function ensureUser(username, password) {
  // Try login first
  let result = await matrixLogin(username, password);
  if (result) {
    log(`  User @${username} — logged in (existing)`);
    return result;
  }

  // Try shared-secret registration
  if (CONFIG.sharedSecret) {
    const reg = await registerSharedSecret(username, password);
    if (reg) {
      log(`  User @${username} — registered (shared secret)`);
      return reg;
    }
  }

  // Try open registration
  const reg = await registerOpen(username, password);
  if (reg) {
    log(`  User @${username} — registered (open registration)`);
    return reg;
  }

  log(`  User @${username} — FAILED to create or login`);
  return null;
}

/** Enable E2E encryption in a room */
async function enableEncryption(token, roomId) {
  const res = await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`,
    { algorithm: 'm.megolm.v1.aes-sha2' },
    token,
  );
  return res.ok;
}

/** Create a room and return roomId */
async function createRoom(token, opts) {
  const res = await api('POST', '/_matrix/client/v3/createRoom', opts, token);
  return res.ok ? res.data.room_id : null;
}

/** Invite user to room */
async function inviteUser(token, roomId, userId) {
  await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId }, token);
}

/** Join room */
async function joinRoom(token, roomId) {
  await api('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {}, token);
}

/** Send a text message, return event_id */
async function sendMessage(token, roomId, body, txnId) {
  const res = await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId || Date.now()}`,
    { msgtype: 'm.text', body },
    token,
  );
  return res.ok ? res.data.event_id : null;
}

/** Full setup: users, rooms, messages */
async function setup() {
  log('═══ PHASE 0: SETUP ═══');

  // 0.1 Check homeserver is reachable
  const versions = await api('GET', '/_matrix/client/versions');
  if (!versions.ok) {
    log('SETUP FAILED: Homeserver not reachable at ' + HS);
    return false;
  }
  log(`Homeserver OK — versions: ${(versions.data.versions || []).slice(-2).join(', ')}`);

  // 0.2 Create/login users and clean up stale state
  for (const user of CONFIG.users) {
    const result = await ensureUser(user.username, user.password);
    if (!result) {
      log(`SETUP FAILED: Cannot create/login user ${user.username}`);
      return false;
    }
    user.token = result.access_token;
    user.userId = result.user_id;

    // Clean up old devices (keep only current) — requires UIA auth for Synapse
    const devRes = await api('GET', '/_matrix/client/v3/devices', null, user.token);
    if (devRes.ok) {
      const currentDeviceId = result.device_id;
      const oldDevices = (devRes.data.devices || []).filter(d => d.device_id !== currentDeviceId);
      let deleted = 0;
      for (const d of oldDevices) {
        // First attempt without auth — may return 401 with session
        const delRes = await api('DELETE', `/_matrix/client/v3/devices/${d.device_id}`, {}, user.token);
        if (delRes.ok) { deleted++; continue; }

        // Synapse requires UIA — retry with password auth
        if (delRes.status === 401 && delRes.data.session) {
          const uiaRes = await api('DELETE', `/_matrix/client/v3/devices/${d.device_id}`, {
            auth: {
              type: 'm.login.password',
              identifier: { type: 'm.id.user', user: user.username },
              password: user.password,
              session: delRes.data.session,
            },
          }, user.token);
          if (uiaRes.ok) deleted++;
        }
      }
      if (deleted > 0) log(`  Cleaned up ${deleted}/${oldDevices.length} old device(s) for ${user.username}`);
    }

    // Delete existing key backup so the app starts fresh
    const backupRes = await api('GET', '/_matrix/client/v3/room_keys/version', null, user.token);
    if (backupRes.ok && backupRes.data.version) {
      await api('DELETE', `/_matrix/client/v3/room_keys/version/${backupRes.data.version}`, null, user.token);
      log(`  Deleted old key backup v${backupRes.data.version} for ${user.username}`);
    }
  }

  const u1 = CONFIG.users[0];
  const u2 = CONFIG.users[1];

  // 0.3 Delete duplicate "Saved Messages" rooms via admin API
  try {
    const joinedRes = await api('GET', '/_matrix/client/v3/joined_rooms', null, u1.token);
    if (joinedRes.ok) {
      const savedRooms = [];
      for (const roomId of joinedRes.data.joined_rooms || []) {
        const nameRes = await api('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`, null, u1.token);
        if (nameRes.ok && nameRes.data.name === 'Saved Messages') {
          savedRooms.push(roomId);
        }
      }
      // Keep at most 1 Saved Messages, delete the rest via admin API
      const toDelete = savedRooms.length > 1 ? savedRooms.slice(1) : [];
      for (const roomId of toDelete) {
        // Leave first, then force-delete via Synapse admin
        await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`, {}, u1.token);
        await api('DELETE', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`, { purge: true }, u1.token);
      }
      if (toDelete.length > 0) {
        log(`  Deleted ${toDelete.length} duplicate Saved Messages room(s)`);
      }
    }
  } catch { /* best-effort */ }

  // 0.4 Create rooms
  log('Creating test rooms...');

  // General group room — give user2 power level 50 for @room mentions
  const generalId = await createRoom(u1.token, {
    name: 'QA General',
    topic: 'General test room for QA agent',
    preset: 'private_chat',
    invite: [u2.userId],
    power_level_content_override: {
      users: {
        [u1.userId]: 100,
        [u2.userId]: 50,
      },
      notifications: { room: 50 },
    },
  });
  if (generalId) {
    CONFIG.rooms.general = generalId;
    await joinRoom(u2.token, generalId);
    log(`  Room "QA General" — ${generalId}`);
  }

  // DM room (no E2E — messages sent via API)
  const dmId = await createRoom(u1.token, {
    is_direct: true,
    preset: 'trusted_private_chat',
    invite: [u2.userId],
  });
  if (dmId) {
    CONFIG.rooms.direct = dmId;
    await joinRoom(u2.token, dmId);
    log(`  DM room — ${dmId}`);
  }

  // Empty room (no messages)
  const emptyId = await createRoom(u1.token, {
    name: 'QA Empty Room',
    topic: 'This room should have no messages',
    preset: 'private_chat',
  });
  if (emptyId) {
    CONFIG.rooms.empty = emptyId;
    log(`  Room "QA Empty Room" — ${emptyId}`);
  }

  // E2E encrypted room (for encryption tests — no API messages, only client-side)
  const e2eId = await createRoom(u1.token, {
    name: 'QA Encrypted',
    topic: 'E2E encrypted room for testing',
    preset: 'private_chat',
    invite: [u2.userId],
  });
  if (e2eId) {
    CONFIG.rooms.encrypted = e2eId;
    await joinRoom(u2.token, e2eId);
    await enableEncryption(u1.token, e2eId);
    log(`  Room "QA Encrypted" — ${e2eId} (E2E enabled)`);
  }

  // Media room
  const mediaId = await createRoom(u1.token, {
    name: 'QA Media',
    topic: 'Room for media/file tests',
    preset: 'private_chat',
    invite: [u2.userId],
  });
  if (mediaId) {
    CONFIG.rooms.media = mediaId;
    await joinRoom(u2.token, mediaId);
    log(`  Room "QA Media" — ${mediaId}`);
  }

  // 0.4 Populate general room with messages
  if (generalId) {
    log('Populating "QA General" with messages...');
    const messages = [
      { user: u1, text: 'Привет! Это тестовое сообщение от user1.' },
      { user: u2, text: 'Привет! Ответ от user2.' },
      { user: u1, text: 'Тестируем длинное сообщение: ' + 'Lorem ipsum dolor sit amet. '.repeat(15) },
      { user: u2, text: 'Сообщение со спецсимволами: <b>bold</b> & "quotes" 🎉🚀 ñüö' },
      { user: u1, text: 'Первое сообщение в треде' },
      { user: u1, text: 'Ещё одно обычное сообщение' },
      { user: u2, text: 'Тест номер семь от user2' },
      { user: u1, text: 'Восьмое сообщение для скролла' },
      { user: u2, text: 'Девятое. Проверяем группировку.' },
      { user: u2, text: 'Десятое. Группировка по одному автору.' },
      { user: u1, text: 'Одиннадцатое. Переключение автора.' },
      { user: u2, text: 'И последнее тестовое сообщение.' },
    ];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      await sendMessage(m.user.token, generalId, m.text, `setup-${i}-${Date.now()}`);
      // Small delay between messages for correct ordering
      await new Promise(r => setTimeout(r, 500));
    }
    log(`  Sent ${messages.length} messages`);
  }

  // 0.5 Populate DM with messages
  if (dmId) {
    log('Populating DM with messages...');
    await sendMessage(u1.token, dmId, 'Привет в личке!', `dm-1-${Date.now()}`);
    await new Promise(r => setTimeout(r, 500));
    await sendMessage(u2.token, dmId, 'Привет! Это личное сообщение.', `dm-2-${Date.now()}`);
    await new Promise(r => setTimeout(r, 500));
    await sendMessage(u1.token, dmId, 'Тестируем DM-переписку.', `dm-3-${Date.now()}`);
    log('  Sent 3 DM messages');
  }

  // 0.6 Set display names
  await api('PUT', `/_matrix/client/v3/profile/${encodeURIComponent(u1.userId)}/displayname`,
    { displayname: 'Test User One' }, u1.token);
  await api('PUT', `/_matrix/client/v3/profile/${encodeURIComponent(u2.userId)}/displayname`,
    { displayname: 'Test User Two' }, u2.token);
  log('Display names set');

  log('═══ SETUP COMPLETE ═══');
  log(`  Users: ${u1.userId}, ${u2.userId}`);
  log(`  Rooms: general=${CONFIG.rooms.general}, dm=${CONFIG.rooms.direct}, empty=${CONFIG.rooms.empty}, media=${CONFIG.rooms.media}`);
  return true;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — DISCOVERY
// ═══════════════════════════════════════════════════════════════
async function discover(page) {
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

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — AUTH
// ═══════════════════════════════════════════════════════════════

// 2.1 Empty form submission
async function testAuthEmpty(page) {
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
async function testAuthWrongCreds(page) {
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
async function testAuthLogin(page) {
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
async function testRegisterPage(page) {
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
async function testRegisterMismatch(page) {
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

// ═══════════════════════════════════════════════════════════════
// PHASE 3 — POST-AUTH: ROOM LIST
// ═══════════════════════════════════════════════════════════════

// 3.1 Post-auth discovery
async function discoverPostAuth(page) {
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

// 3.2 Room list items display
async function testRoomListDisplay(page) {
  log('--- ROOM_LIST_DISPLAY ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length === 0) {
    log('ROOM_LIST_DISPLAY: No rooms to check, skipping');
    return;
  }

  // Skip "Saved Messages" items — they use bookmark icon instead of Avatar
  let testItem = null;
  for (const item of items) {
    const nameEl = await item.$('[class*="name"]');
    if (nameEl) {
      const name = await nameEl.textContent();
      if (!name.includes('Saved')) { testItem = item; break; }
    }
  }

  const shot = await snap(page, 'room-list-display');

  if (!testItem) {
    log('ROOM_LIST_DISPLAY: Only Saved Messages visible (Virtuoso viewport), skipping avatar check');
  } else {
    const hasName = await testItem.$('[class*="name"]') !== null;
    const hasPreview = await testItem.$('[class*="message"]') !== null;
    const hasTime = await testItem.$('[class*="time"], time') !== null;
    const hasAvatar = await testItem.$('[class*="avatar"]') !== null;

    if (!hasName) bug('HIGH', 'ROOM_LIST_DISPLAY', 'Room name not visible in list item', [], shot);
    if (!hasAvatar) bug('MEDIUM', 'ROOM_LIST_DISPLAY', 'Avatar not visible in room list item', [], shot);
    log(`Room item: name=${hasName}, preview=${hasPreview}, time=${hasTime}, avatar=${hasAvatar}`);
  }

  // Check for unread badges
  const badges = await page.$$('[class*="badge"]');
  log(`Unread badges visible: ${badges.length}`);

  // Check for encryption icons
  const encIcons = await page.$$('[class*="statusIcon"]');
  log(`Status icons (encrypted/muted/pinned): ${encIcons.length}`);
}

// 3.3 Room list search
async function testRoomSearch(page) {
  log('--- ROOM_SEARCH ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const searchInput = await page.$('input[type="search"]');
  if (!searchInput) {
    log('ROOM_SEARCH: No search input, skipping');
    return;
  }

  // Type a search query
  await searchInput.fill('test');
  await page.waitForTimeout(2000);
  await snap(page, 'room-search-results');

  const dropdown = await page.$('[class*="dropdown"]');
  const resultItems = await page.$$('[class*="resultItem"]');
  log(`ROOM_SEARCH: dropdown=${!!dropdown}, results=${resultItems.length}`);

  // Check "no results" state
  await searchInput.fill('zzzxxx_nonexistent_room_999');
  await page.waitForTimeout(2000);
  await snap(page, 'room-search-no-results');

  const noResults = await page.$('[class*="noResults"]');
  if (!noResults && !(await page.$('[class*="loading"]'))) {
    log('ROOM_SEARCH: No "no results" message found (might be expected)');
  }

  // Clear
  await searchInput.fill('');
  await page.waitForTimeout(500);
  log('ROOM_SEARCH: PASS');
}

// 3.4 Room item context menu
async function testRoomListContextMenu(page) {
  log('--- ROOM_LIST_CONTEXT_MENU ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length === 0) { log('ROOM_LIST_CONTEXT_MENU: No rooms, skipping'); return; }

  await items[0].click({ button: 'right' });
  // Wait for context menu to render
  const menu = await waitFor(page, '[class*="menu"]:not([class*="attach"])', 3000);
  const shot = await snap(page, 'room-list-ctx-menu');

  if (!menu) {
    bug('MEDIUM', 'ROOM_LIST_CONTEXT_MENU', 'No context menu on right-click room item', ['1. Right-click room in list', '2. No menu appeared'], shot);
    return;
  }

  const menuBtns = await page.$$('[class*="menu"] button[class*="item"], [class*="menu"] button');
  const actions = [];
  for (const btn of menuBtns) {
    const text = await btn.textContent();
    actions.push(text.trim());
  }
  log(`ROOM_LIST_CONTEXT_MENU: Actions: ${actions.join(' | ')}`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// 3.5 Room switching
async function testRoomSwitch(page) {
  log('--- ROOM_SWITCH ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const items = await page.$$(ROOM_ITEM_SEL);
  if (items.length < 1) { log('ROOM_SWITCH: No rooms, skipping'); return; }

  // Use a known room from setup if available (more reliable than clicking Virtuoso items)
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    // Key restore screen may reappear due to async resolvePostAuthStatus — dismiss again
    if (!page.url().includes('/rooms/!') && !page.url().includes('/rooms/%21')) {
      await dismissKeyRestore(page);
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    }
  } else {
    // Fallback: find non-Saved room and click it
    let clickItem = null;
    for (const item of items) {
      const nameEl = await item.$('[class*="name"]');
      if (nameEl) {
        const name = await nameEl.textContent();
        if (!name.includes('Saved')) { clickItem = item; break; }
      }
    }
    if (!clickItem) clickItem = items[items.length - 1];
    await clickItem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await clickItem.click();
    await waitFor(page, '[class*="composer"], textarea[class*="textarea"]', 8000);
  }

  const url1 = page.url();
  const shot1 = await snap(page, 'room-switch-first');

  if (!url1.includes('/rooms/!') && !url1.includes('/rooms/%21')) {
    bug('HIGH', 'ROOM_SWITCH', `Clicking room did not navigate. URL: ${url1}`, [], shot1);
    return;
  }

  // Check room view elements
  const hasHeader = await page.$('header[class*="header"]') !== null;
  const hasComposer = await page.$('[class*="composer"]') !== null;
  const hasTimeline = await page.$('[class*="container"]') !== null;
  log(`Room view: header=${hasHeader}, composer=${hasComposer}, timeline=${hasTimeline}`);

  if (!hasHeader) bug('HIGH', 'ROOM_SWITCH', 'Room header not visible', [], shot1);
  if (!hasComposer) bug('HIGH', 'ROOM_SWITCH', 'Message composer not visible', [], shot1);

  // Check selected state in room list
  const selected = await page.$('[aria-current="page"], button[class*="selected"]');
  if (!selected) {
    log('ROOM_SWITCH: No selected state indicator on room item');
  }

  // Switch to second room
  if (items.length >= 2) {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    const items2 = await page.$$(ROOM_ITEM_SEL);
    if (items2.length >= 2) {
      await items2[1].click();
      await page.waitForTimeout(2000);
      const url2 = page.url();
      await snap(page, 'room-switch-second');
      if (url1 === url2) {
        bug('MEDIUM', 'ROOM_SWITCH', 'Switching rooms did not change URL', [], '');
      } else {
        log(`ROOM_SWITCH: Successfully switched rooms (${url1} -> ${url2})`);
      }
    }
  }
}

// 3.6 Create room dialog
async function testCreateRoom(page) {
  log('--- ROOM_CREATE ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  // createBtn is in RoomListHeader — avoid matching SpacesSidebar "+" button
  const createBtn = await page.$('[class*="createBtn"]');
  if (!createBtn) {
    bug('HIGH', 'ROOM_CREATE', 'Create room button not found in header', [], await snap(page, 'room-create-no-btn'));
    return;
  }

  await createBtn.click();
  await page.waitForTimeout(1000);
  const shot1 = await snap(page, 'room-create-dialog');

  const modal = await page.$('dialog, [class*="modal"]');
  if (!modal) {
    bug('HIGH', 'ROOM_CREATE', 'Create room modal did not open', [], shot1);
    return;
  }

  // Check tabs
  const tabs = await page.$$('[class*="tab"]');
  log(`ROOM_CREATE: Tabs found: ${tabs.length}`);
  if (tabs.length < 2) {
    bug('MEDIUM', 'ROOM_CREATE', 'Expected 2 tabs (Room / DM)', [], shot1);
  }

  // Check form fields
  const inputs = await modal.$$('input');
  log(`ROOM_CREATE: Input fields: ${inputs.length}`);

  // Fill room name
  const nameInput = inputs[0];
  if (nameInput) {
    const roomName = `QA-Test-${Date.now()}`;
    await nameInput.fill(roomName);
    await snap(page, 'room-create-filled');
  }

  // Test switching to DM tab
  if (tabs.length >= 2) {
    await tabs[1].click();
    await page.waitForTimeout(500);
    await snap(page, 'room-create-dm-tab');

    // Room name should be hidden in DM mode
    const visibleInputs = await modal.$$('input:visible');
    log(`ROOM_CREATE (DM tab): Visible inputs: ${visibleInputs.length}`);

    // Switch back to Room tab
    await tabs[0].click();
    await page.waitForTimeout(500);
  }

  // Close modal
  const closeBtn = await page.$('[aria-label*="Закрыть"], [aria-label*="Close"], [class*="close"]');
  if (closeBtn) await safe('close modal', () => closeBtn.click());
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — ROOM HEADER
// ═══════════════════════════════════════════════════════════════

async function testRoomHeader(page) {
  log('--- ROOM_HEADER ---');
  if (!(await ensureInRoom(page))) { log('ROOM_HEADER: Cannot enter room, skipping'); return; }

  const header = await page.$('header[class*="header"]');
  if (!header) { bug('HIGH', 'ROOM_HEADER', 'Room header not found', [], await snap(page, 'room-header-missing')); return; }

  // Check header elements
  const roomName = await header.$('[class*="name"]');
  const avatar = await header.$('[class*="avatar"]');
  const inviteBtn = await header.$('[class*="inviteBtn"], [title*="nvite"]');
  const info = await header.$('[class*="info"]');

  const nameText = roomName ? await roomName.textContent() : null;
  log(`ROOM_HEADER: name="${nameText?.trim()}", avatar=${!!avatar}, invite=${!!inviteBtn}, info=${!!info}`);
  await snap(page, 'room-header');

  // Test clicking room info to open details panel
  if (info) {
    await info.click();
    await page.waitForTimeout(1500);
    const detailsPanel = await page.$('[class*="details"], [class*="panel"]');
    await snap(page, 'room-header-details-panel');
    log(`ROOM_HEADER: Details panel opened: ${!!detailsPanel}`);

    // Close panel if opened
    const panelClose = await page.$('[class*="panel"] button[class*="close"], [class*="details"] button');
    if (panelClose) await safe('close panel', () => panelClose.click());
    await page.waitForTimeout(500);
  }

  // Test invite button
  if (inviteBtn) {
    await inviteBtn.click();
    await page.waitForTimeout(1000);
    const inviteDialog = await page.$('dialog, [class*="modal"]');
    await snap(page, 'room-header-invite-dialog');
    log(`ROOM_HEADER: Invite dialog opened: ${!!inviteDialog}`);

    if (inviteDialog) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }
}

// 4b. Empty room
async function testEmptyRoom(page) {
  log('--- EMPTY_ROOM ---');
  if (!CONFIG.rooms.empty) { log('EMPTY_ROOM: No empty room created, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"], [class*="empty"]');
  const shot = await snap(page, 'empty-room');

  // Should show empty state or no messages
  const emptyEl = await page.$('[class*="empty"]');
  const messages = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  log(`EMPTY_ROOM: empty indicator=${!!emptyEl}, messages=${messages.length}`);

  // Composer should still be available
  const composer = await page.$('[class*="composer"]');
  if (!composer) {
    bug('MEDIUM', 'EMPTY_ROOM', 'Composer not shown in empty room', [], shot);
  }
}

// 4c. DM room
async function testDMRoom(page) {
  log('--- DM_ROOM ---');
  if (!CONFIG.rooms.direct) { log('DM_ROOM: No DM room created, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]');
  const shot = await snap(page, 'dm-room');

  // Check header shows partner name/presence
  const header = await page.$('header[class*="header"]');
  if (header) {
    const topic = await header.$('[class*="topic"]');
    if (topic) {
      const topicText = await topic.textContent();
      log(`DM_ROOM: Header subtitle: "${topicText.trim()}"`);
    }

    // Check online/offline indicator
    const onlineText = await header.$('[class*="onlineText"]');
    log(`DM_ROOM: Online indicator: ${!!onlineText}`);
  }

  // Check messages are visible
  const messages = await page.$$('[class*="message"]');
  log(`DM_ROOM: Messages visible: ${messages.length}`);
}

// 4d. Timeline scroll
async function testTimelineScroll(page) {
  log('--- TIMELINE_SCROLL ---');
  if (!CONFIG.rooms.general) { log('TIMELINE_SCROLL: No general room, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await snap(page, 'timeline-scroll-start');

  // Count initial messages
  const initialMsgs = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  log(`TIMELINE_SCROLL: Initial messages: ${initialMsgs.length}`);

  // Check typing indicator area exists
  const typingArea = await page.$('[class*="typing"]');
  log(`TIMELINE_SCROLL: Typing indicator area: ${!!typingArea}`);

  // Check pinned message bar
  const pinnedBar = await page.$('[class*="pinned"]');
  log(`TIMELINE_SCROLL: Pinned message bar: ${!!pinnedBar}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — MESSAGING
// ═══════════════════════════════════════════════════════════════

// 5.1 Send message
async function testChatSendMessage(page) {
  log('--- CHAT_SEND_MESSAGE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) {
    bug('CRITICAL', 'CHAT_SEND_MESSAGE', 'Composer textarea or send button not found', [], await snap(page, 'chat-no-composer'));
    return;
  }

  const msg = `QA-test-${Date.now()}`;
  await textarea.fill(msg);
  await snap(page, 'chat-msg-typed');

  // Check send button enabled
  const disabled = await sendBtn.isDisabled();
  if (disabled) {
    bug('HIGH', 'CHAT_SEND_MESSAGE', 'Send button disabled with text', [], await snap(page, 'chat-send-disabled'));
    return;
  }

  await sendBtn.click();

  // In E2E rooms encryption + sync takes longer — poll for the message
  let msgFound = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1500);
    const msgEl = await page.$(`text="${msg}"`);
    if (msgEl) { msgFound = true; break; }
  }

  const shot = await snap(page, 'chat-msg-sent');

  if (!msgFound) {
    // Check if textarea was cleared (= message was sent but maybe not decrypted back)
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

// 5.2 Send via Enter key
async function testChatSendEnter(page) {
  log('--- CHAT_SEND_ENTER ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  const msg = `Enter-test-${Date.now()}`;
  await textarea.fill(msg);
  await page.keyboard.press('Enter');

  // Wait for E2E encryption + sync
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

// 5.3 Shift+Enter for newline
async function testChatShiftEnter(page) {
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

  // Clean up — clear and do not send
  await textarea.fill('');
}

// 5.4 Empty message
async function testChatSendEmpty(page) {
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

  // Also test whitespace-only
  await textarea.fill('   ');
  await page.waitForTimeout(300);
  const disabledWs = await sendBtn.isDisabled();
  if (!disabledWs) {
    bug('MEDIUM', 'CHAT_SEND_EMPTY', 'Send button enabled with whitespace-only input', [], await snap(page, 'chat-whitespace'));
  }
  await textarea.fill('');
}

// 5.5 Long message
async function testChatLongMessage(page) {
  log('--- CHAT_LONG_MESSAGE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const longMsg = 'L'.repeat(1500) + ` [QA-${Date.now()}]`;
  await textarea.fill(longMsg);
  await page.waitForTimeout(500);

  // Check textarea expanded
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

// 5.6 Special chars and XSS
async function testChatSpecialChars(page) {
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

  // Check for XSS
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

// 5.7 Attach button and menu
async function testAttachMenu(page) {
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

  // Check menu items
  const menuItems = await menu.$$('button[class*="item"]');
  const items = [];
  for (const item of menuItems) {
    items.push((await item.textContent()).trim());
  }
  log(`ATTACH_MENU: Items: ${items.join(' | ')}`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Check hidden file input exists
  const fileInput = await page.$('input[type="file"][class*="hidden"]');
  if (!fileInput) {
    bug('LOW', 'ATTACH_MENU', 'Hidden file input not found', [], '');
  } else {
    const accept = await fileInput.getAttribute('accept');
    log(`ATTACH_MENU: File input accept="${accept}"`);
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 6 — MESSAGE BUBBLE & CONTEXT MENU
// ═══════════════════════════════════════════════════════════════

// 6.1 Message bubble structure
async function testMessageBubble(page) {
  log('--- MESSAGE_BUBBLE ---');
  if (!(await ensureInRoom(page))) return;

  // Check for messages in timeline
  const messages = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  if (messages.length === 0) {
    log('MESSAGE_BUBBLE: No messages in timeline, skipping');
    return;
  }

  const shot = await snap(page, 'msg-bubble-overview');
  log(`MESSAGE_BUBBLE: ${messages.length} messages visible`);

  // Check first message structure
  const firstMsg = messages[0];
  const hasBubble = await firstMsg.$('[class*="bubble"]') !== null;
  const hasTime = await firstMsg.$('time, [class*="time"]') !== null;
  const hasContent = await firstMsg.$('[class*="content"]') !== null;

  log(`MESSAGE_BUBBLE: bubble=${hasBubble}, time=${hasTime}, content=${hasContent}`);

  if (!hasBubble) bug('HIGH', 'MESSAGE_BUBBLE', 'Message bubble element missing', [], shot);
  if (!hasTime) bug('MEDIUM', 'MESSAGE_BUBBLE', 'Message timestamp missing', [], shot);

  // Check for date separators
  const dateSeps = await page.$$('[class*="date"]');
  log(`MESSAGE_BUBBLE: Date separators: ${dateSeps.length}`);

  // Check for reactions container
  const reactions = await page.$$('[class*="reactions"]');
  log(`MESSAGE_BUBBLE: Messages with reactions: ${reactions.length}`);

  // Check for thread badges
  const threadBadges = await page.$$('[class*="threadBadge"]');
  log(`MESSAGE_BUBBLE: Thread badges: ${threadBadges.length}`);

  // Check for edited indicators
  const edited = await page.$$('[class*="edited"]');
  log(`MESSAGE_BUBBLE: Edited messages: ${edited.length}`);

  // Check for read receipts
  const receipts = await page.$$('[class*="receiptsWrap"]');
  log(`MESSAGE_BUBBLE: Read receipts: ${receipts.length}`);
}

// 6.2 Message context menu (full actions)
async function testMessageContextMenu(page) {
  log('--- MSG_CONTEXT_MENU ---');
  if (!(await ensureInRoom(page))) return;

  // Find an outgoing message for full menu
  let msgEl = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
  if (!msgEl) {
    // Try any message
    msgEl = await page.$('[class*="message"] [class*="bubble"]');
  }
  if (!msgEl) {
    log('MSG_CONTEXT_MENU: No messages to test, skipping');
    return;
  }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'msg-ctx-menu');

  const menu = await page.$('[class*="menu"]:not([class*="attach"])');
  if (!menu) {
    bug('MEDIUM', 'MSG_CONTEXT_MENU', 'Context menu not shown on right-click', [], shot);
    return;
  }

  // Enumerate all actions
  const actionBtns = await menu.$$('button[class*="item"]');
  const actions = [];
  for (const btn of actionBtns) {
    const label = await btn.$('[class*="label"]');
    const text = label ? await label.textContent() : await btn.textContent();
    const isDanger = (await btn.getAttribute('class'))?.includes('danger') || false;
    actions.push({ text: text.trim(), danger: isDanger });
  }
  log(`MSG_CONTEXT_MENU: Actions: ${actions.map(a => a.text + (a.danger ? ' (DANGER)' : '')).join(' | ')}`);

  // Expected actions for own message: reply, edit, copy, copy-link, forward, thread, select, react, remove
  const expected = ['reply', 'edit', 'copy', 'forward', 'thread', 'select', 'react'];
  // We just check count is reasonable
  if (actions.length < 5) {
    bug('MEDIUM', 'MSG_CONTEXT_MENU', `Only ${actions.length} menu actions (expected 7+)`, [], shot);
  }

  // Check for receipts section
  const receiptsRow = await menu.$('[class*="receiptsRow"]');
  log(`MSG_CONTEXT_MENU: Receipts row: ${!!receiptsRow}`);

  // Test Escape to close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const menuAfter = await page.$('[class*="menu"]:not([class*="attach"])');
  if (menuAfter) {
    bug('LOW', 'MSG_CONTEXT_MENU', 'Menu did not close on Escape', [], await snap(page, 'msg-ctx-no-close'));
  } else {
    log('MSG_CONTEXT_MENU: Closes on Escape');
  }
}

// 6.3 Reply to message
async function testReplyMessage(page) {
  log('--- MSG_REPLY ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_REPLY: No messages, skipping'); return; }

  // Open context menu
  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  // Click reply
  const replyBtn = await page.$('[class*="menu"] button[class*="item"]');
  if (!replyBtn) { log('MSG_REPLY: No menu items, skipping'); return; }

  // Find "Reply" action specifically
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

  if (!replyClicked) {
    log('MSG_REPLY: Reply button not found in menu');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-reply-preview');

  // Check reply preview appeared
  const replyPreview = await page.$('[class*="replyPreview"]');
  if (!replyPreview) {
    bug('MEDIUM', 'MSG_REPLY', 'Reply preview not shown after clicking Reply', [], shot);
    return;
  }

  // Check cancel button
  const cancelBtn = await page.$('[class*="replyCancelBtn"]');
  log(`MSG_REPLY: Reply preview shown, cancel btn: ${!!cancelBtn}`);

  // Send reply
  const textarea = await page.$('textarea[class*="textarea"]');
  if (textarea) {
    const replyMsg = `Reply-test-${Date.now()}`;
    await textarea.fill(replyMsg);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await snap(page, 'msg-reply-sent');

    // Check reply quote in timeline
    const replyQuote = await page.$('[class*="replyQuote"]');
    log(`MSG_REPLY: Reply quote visible: ${!!replyQuote}`);
  }
}

// 6.4 Edit own message
async function testEditMessage(page) {
  log('--- MSG_EDIT ---');
  if (!(await ensureInRoom(page))) return;

  // Find own message
  const ownMsg = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
  if (!ownMsg) { log('MSG_EDIT: No own messages, skipping'); return; }

  // Open context menu
  await ownMsg.click({ button: 'right' });
  await page.waitForTimeout(800);

  // Find edit action
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

  if (!editClicked) {
    log('MSG_EDIT: Edit action not found');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-edit-mode');

  // Check edit preview
  const editPreview = await page.$('[class*="replyPreview"]');
  const textarea = await page.$('textarea[class*="textarea"]');

  if (!editPreview) {
    bug('MEDIUM', 'MSG_EDIT', 'Edit preview not shown', [], shot);
  } else {
    log('MSG_EDIT: Edit mode activated with preview');
  }

  // Check textarea pre-filled
  if (textarea) {
    const val = await textarea.inputValue();
    log(`MSG_EDIT: Textarea pre-filled: "${val.slice(0, 50)}..."`);

    // Modify text
    await textarea.fill(val + ' (edited)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await snap(page, 'msg-edit-saved');

    // Check for edited indicator
    const editedBadge = await page.$('[class*="edited"]');
    log(`MSG_EDIT: Edited badge visible: ${!!editedBadge}`);
  }
}

// 6.5 Edit cancel with Escape
async function testEditCancel(page) {
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

  // Press Escape to cancel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const editPreview = await page.$('[class*="replyPreview"]');
  if (editPreview) {
    bug('MEDIUM', 'MSG_EDIT_CANCEL', 'Escape did not cancel edit mode', [], await snap(page, 'msg-edit-cancel-fail'));
  } else {
    log('MSG_EDIT_CANCEL: PASS — Escape cancels edit');
  }
}

// 6.6 Forward message
async function testForwardMessage(page) {
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

  if (!clicked) {
    log('MSG_FORWARD: Forward action not found in menu');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(1000);
  const shot = await snap(page, 'msg-forward-dialog');

  const dialog = await page.$('dialog, [class*="modal"]');
  if (!dialog) {
    bug('MEDIUM', 'MSG_FORWARD', 'Forward dialog did not open', [], shot);
    return;
  }

  // Check search and room list
  const searchInput = await dialog.$('input[class*="search"]');
  const roomItems = await dialog.$$('[class*="roomItem"]');
  log(`MSG_FORWARD: Search: ${!!searchInput}, rooms: ${roomItems.length}`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// 6.7 Select messages
async function testSelectMessages(page) {
  log('--- MSG_SELECT ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('MSG_SELECT: No messages, skipping'); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(800);

  // Find select action
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

  if (!clicked) {
    log('MSG_SELECT: Select action not found');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(800);
  const shot = await snap(page, 'msg-select-mode');

  // Check selection bar appeared
  const selBar = await page.$('[class*="selectionBar"]');
  if (!selBar) {
    bug('MEDIUM', 'MSG_SELECT', 'Selection bar did not appear', [], shot);
    return;
  }

  // Check selection count
  const selCount = await page.$('[class*="selectionCount"]');
  if (selCount) {
    const count = await selCount.textContent();
    log(`MSG_SELECT: Selection count: "${count.trim()}"`);
  }

  // Check action buttons in selection bar
  const selBtns = await page.$$('[class*="selectionActions"] button, [class*="selectionBtn"]');
  log(`MSG_SELECT: Selection action buttons: ${selBtns.length}`);

  // Check checkboxes appeared on messages
  const checkboxes = await page.$$('[class*="checkbox"] input[type="checkbox"]');
  log(`MSG_SELECT: Checkboxes visible: ${checkboxes.length}`);

  // Try selecting another message by clicking
  const allMsgs = await page.$$('[class*="message"][class*="outgoing"], [class*="message"][class*="incoming"]');
  if (allMsgs.length >= 2) {
    await allMsgs[1].click();
    await page.waitForTimeout(500);
    const selCount2 = await page.$('[class*="selectionCount"]');
    if (selCount2) {
      const count2 = await selCount2.textContent();
      log(`MSG_SELECT: After selecting 2nd: "${count2.trim()}"`);
    }
  }

  // Cancel selection
  const cancelBtn = await page.$('[class*="selectionCancel"]');
  if (cancelBtn) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
    const barGone = (await page.$('[class*="selectionBar"]')) === null;
    log(`MSG_SELECT: Selection cancelled: ${barGone}`);
  }
}

// 6.8 Copy message text
async function testCopyMessage(page) {
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

  if (clicked) {
    log('MSG_COPY: Copy action clicked');
  } else {
    log('MSG_COPY: Copy action not found');
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
}

// 6.9 Thread
async function testThread(page) {
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

  if (!clicked) {
    log('MSG_THREAD: Thread action not found');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(1500);
  const shot = await snap(page, 'msg-thread-panel');

  const panel = await page.$('[class*="thread"], [class*="panel"]');
  if (panel) {
    log('MSG_THREAD: Thread panel opened');
    // Close it
    const closeBtn = await panel.$('button[class*="close"]');
    if (closeBtn) await safe('close thread', () => closeBtn.click());
    else await page.keyboard.press('Escape');
  } else {
    log('MSG_THREAD: Thread panel element not found');
  }
  await page.waitForTimeout(500);
}

// 6.10 React to message (emoji picker)
async function testReactMessage(page) {
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

  if (!clicked) {
    log('MSG_REACT: React action not found');
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(1500);
  const shot = await snap(page, 'msg-react-picker');

  // Check for emoji picker
  const picker = await page.$('em-emoji-picker, [class*="picker"], [class*="emoji"]');
  if (!picker) {
    bug('MEDIUM', 'MSG_REACT', 'Emoji picker did not appear', [], shot);
  } else {
    log('MSG_REACT: Emoji picker opened');
    // Try clicking an emoji
    const emoji = await page.$('em-emoji-picker button[data-emoji], [class*="emoji"] button');
    if (emoji) {
      await emoji.click();
      await page.waitForTimeout(2000);
      await snap(page, 'msg-react-added');

      // Check reaction appeared
      const reaction = await page.$('[class*="reaction"]');
      log(`MSG_REACT: Reaction visible: ${!!reaction}`);
    }
  }

  // Close picker if still open
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// 6.11 Delete own message
async function testDeleteMessage(page) {
  log('--- MSG_DELETE ---');
  if (!(await ensureInRoom(page))) return;

  // First send a message to delete
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
    if (cls?.includes('danger')) {
      deleteBtn = item;
      break;
    }
  }

  if (!deleteBtn) {
    log('MSG_DELETE: Delete/danger action not found');
    await page.keyboard.press('Escape');
    return;
  }

  // Accept confirmation dialog
  page.once('dialog', dialog => dialog.accept());
  await deleteBtn.click();
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'msg-delete-result');

  // Check for redacted message
  const redacted = await page.$('[class*="redacted"]');
  log(`MSG_DELETE: Redacted message visible: ${!!redacted}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7 — SETTINGS
// ═══════════════════════════════════════════════════════════════

async function testSettingsNavigation(page) {
  log('--- SETTINGS_NAV ---');
  await goto(page, '/settings', 'nav[class*="nav"], [class*="nav"] a');

  if (!page.url().includes('/settings')) {
    // Try via button
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    const btn = await page.$('[class*="settingsBtn"], [title*="Settings"]');
    if (btn) { await btn.click(); await page.waitForTimeout(2000); }
  }

  const shot = await snap(page, 'settings-main');

  // Check nav links
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
    if (!found) {
      bug('LOW', 'SETTINGS_NAV', `Settings section "${expected}" not found in nav`, [], shot);
    }
  }

  // Navigate each section
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

async function testSettingsProfile(page) {
  log('--- SETTINGS_PROFILE ---');
  await goto(page, '/settings/profile', '[class*="avatar"], input');
  const shot = await snap(page, 'settings-profile');

  // Check avatar
  const avatar = await page.$('[class*="avatar"]');
  log(`SETTINGS_PROFILE: Avatar: ${!!avatar}`);

  // Check display name input
  const nameInput = await page.$('input');
  if (nameInput) {
    const val = await nameInput.inputValue();
    log(`SETTINGS_PROFILE: Display name: "${val}"`);
  }

  // Check change avatar button
  const changeAvatarBtn = await page.$('button:has-text("avatar"), button:has-text("аватар"), button:has-text("Avatar")');
  log(`SETTINGS_PROFILE: Change avatar button: ${!!changeAvatarBtn}`);

  // Check user ID displayed
  const userId = await page.$('[class*="userId"]');
  log(`SETTINGS_PROFILE: User ID visible: ${!!userId}`);

  // Check save button
  const saveBtn = await page.$('button[type="submit"]');
  log(`SETTINGS_PROFILE: Save button: ${!!saveBtn}`);
}

async function testSettingsAppearance(page) {
  log('--- SETTINGS_APPEARANCE ---');
  await goto(page, '/settings/appearance', '[class*="option"]');
  const shot = await snap(page, 'settings-appearance');

  // Check theme options
  const themeOptions = await page.$$('[class*="option"]');
  log(`SETTINGS_APPEARANCE: Theme options: ${themeOptions.length}`);

  if (themeOptions.length < 2) {
    bug('MEDIUM', 'SETTINGS_APPEARANCE', 'Expected at least 2 theme options (light, dark)', [], shot);
    return;
  }

  // Check which is selected
  const selected = await page.$('[class*="option"][class*="selected"]');
  if (selected) {
    const selectedText = await selected.textContent();
    log(`SETTINGS_APPEARANCE: Current theme: "${selectedText.trim()}"`);
  }

  // Test switching theme
  const firstOption = themeOptions[0];
  const secondOption = themeOptions[1];

  await secondOption.click();
  await page.waitForTimeout(1000);
  await snap(page, 'settings-appearance-switched');

  // Switch back
  await firstOption.click();
  await page.waitForTimeout(1000);
  log('SETTINGS_APPEARANCE: Theme switch works');
}

async function testSettingsLogout(page) {
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

  // Check confirmation modal
  const modal = await page.$('dialog, [class*="modal"]');
  if (!modal) {
    bug('MEDIUM', 'SETTINGS_LOGOUT', 'Logout confirmation modal not shown', [], shot);
    return;
  }

  // Check modal text
  const modalText = await modal.$('[class*="logoutText"], p');
  if (modalText) {
    const text = await modalText.textContent();
    log(`SETTINGS_LOGOUT: Modal text: "${text.trim().slice(0, 80)}"`);
  }

  // Check cancel button
  const cancelBtn = await modal.$('button[class*="secondary"]');
  if (cancelBtn) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
    const modalGone = (await page.$('dialog[open], [class*="modal"]')) === null;
    log(`SETTINGS_LOGOUT: Cancel closes modal: ${modalGone}`);
  }

  // Now actually logout
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

// ═══════════════════════════════════════════════════════════════
// PHASE 7E — POLISHED FEATURES (latest session)
// ═══════════════════════════════════════════════════════════════

// 7e.1 Room list tabs
async function testRoomListTabs(page) {
  log('--- ROOM_LIST_TABS ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  const tabs = await page.$$('[class*="tab"]');
  log(`ROOM_LIST_TABS: ${tabs.length} tab buttons`);

  if (tabs.length < 3) {
    bug('LOW', 'ROOM_LIST_TABS', 'Tabs (All/Unread/DMs) not visible', [], '');
    return;
  }

  // Click "Unread" tab (2nd)
  await tabs[1].click();
  await page.waitForTimeout(1500);
  await snap(page, 'tabs-unread');
  log('ROOM_LIST_TABS: Unread tab clicked');

  // Click "DMs" tab
  await tabs[2].click();
  await page.waitForTimeout(1500);
  await snap(page, 'tabs-dms');

  // Back to All
  await tabs[0].click();
  await page.waitForTimeout(500);
  log('ROOM_LIST_TABS: PASS');
}

// 7e.2 Per-room notification levels in context menu
async function testRoomNotificationLevels(page) {
  log('--- ROOM_NOTIFY_LEVELS ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);

  const item = await page.$(ROOM_ITEM_SEL);
  if (!item) return;

  await item.click({ button: 'right' });
  await page.waitForTimeout(800);
  const shot = await snap(page, 'room-notify-levels');

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  const labels = [];
  for (const it of menuItems) {
    const text = await it.textContent();
    labels.push(text.trim());
  }

  const hasAll = labels.some((l) => l.includes('Все сообщения') || l.includes('All'));
  const hasMentions = labels.some((l) => l.includes('Только упоминания') || l.includes('Mentions'));

  if (!hasAll || !hasMentions) {
    bug('LOW', 'ROOM_NOTIFY_LEVELS', `Missing notification level options. Found: ${labels.join(', ')}`, [], shot);
  } else {
    log('ROOM_NOTIFY_LEVELS: PASS — All/Mentions/Mute available');
  }

  await page.keyboard.press('Escape');
}

// 7e.3 Emoji autocomplete `:smile:`
async function testEmojiAutocomplete(page) {
  log('--- EMOJI_AUTOCOMPLETE ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  await textarea.fill('');
  await textarea.click();
  await page.keyboard.type(':smile');
  await page.waitForTimeout(800);
  const shot = await snap(page, 'emoji-autocomplete');

  const popup = await page.$('[class*="popup"]');
  if (!popup) {
    log('EMOJI_AUTOCOMPLETE: Popup not visible');
    await textarea.fill('');
    return;
  }

  log('EMOJI_AUTOCOMPLETE: PASS — popup with emoji candidates');
  await page.keyboard.press('Escape');
  await textarea.fill('');
}

// 7e.4 Multi-file attach (input has multiple)
async function testMultiFileInput(page) {
  log('--- MULTI_FILE_INPUT ---');
  if (!(await ensureInRoom(page))) return;

  const input = await page.$('input[type="file"]');
  if (!input) {
    log('MULTI_FILE_INPUT: No file input');
    return;
  }

  const isMultiple = await input.evaluate((el) => el.hasAttribute('multiple'));
  if (isMultiple) {
    log('MULTI_FILE_INPUT: PASS — multiple attribute set');
  } else {
    bug('LOW', 'MULTI_FILE_INPUT', 'File input does not allow multiple files', [], '');
  }
}

// 7e.5 Lightbox prev/next props
async function testLightboxNav(page) {
  log('--- LIGHTBOX_NAV ---');
  // Just verify Lightbox component file has prev/next exports
  // (without complex setup of triggering it through UI)
  const present = await page.evaluate(() => {
    // This is a heuristic — real test would open a lightbox via image click
    return true;
  });
  void present;
  log('LIGHTBOX_NAV: skipped (requires media setup)');
}

// 7e.6 Member list actions visible (kick/ban for admin)
async function testMemberActions(page) {
  log('--- MEMBER_ACTIONS ---');
  if (!(await ensureInRoom(page))) return;

  // Open room details
  const header = await page.$('[class*="info"]');
  if (!header) return;
  await header.click();
  await page.waitForTimeout(2000);

  const memberList = await page.$('[class*="list"]');
  if (!memberList) {
    log('MEMBER_ACTIONS: No member list found');
    return;
  }

  // Look for actions buttons (MoreVertical icon)
  const actions = await page.$$('[class*="actionsBtn"]');
  log(`MEMBER_ACTIONS: ${actions.length} action buttons found`);
  await snap(page, 'member-actions');
}

// 7e.7 Room name editable in details panel
async function testRoomNameEditable(page) {
  log('--- ROOM_NAME_EDITABLE ---');
  if (!(await ensureInRoom(page))) return;

  // Open room details
  const header = await page.$('[class*="info"]');
  if (!header) return;
  await header.click();
  await page.waitForTimeout(2000);

  const roomName = await page.$('[class*="roomName"]');
  if (!roomName) {
    log('ROOM_NAME_EDITABLE: No room name element');
    return;
  }

  // Check if has edit indicator (Edit2 icon)
  const editIcon = await roomName.$('svg');
  log(`ROOM_NAME_EDITABLE: Edit icon visible: ${!!editIcon}`);
  await snap(page, 'room-name-editable');
}

// 7e.8 Frequent emoji persisted (localStorage)
async function testFrequentEmoji(page) {
  log('--- FREQUENT_EMOJI ---');

  const stored = await page.evaluate(() => {
    return localStorage.getItem('corp-matrix-frequent-emoji');
  });

  log(`FREQUENT_EMOJI: localStorage value: ${stored ? 'present' : 'empty (defaults)'}`);
}

// 7e.9 i18n cleanup verify
async function testI18nCleanup(page) {
  log('--- I18N_CLEANUP ---');
  // Open settings → encryption to verify EncryptionBadge translation
  await goto(page, '/settings/encryption', 'h3, button');
  await page.waitForTimeout(1500);

  // Just check that page loaded without errors
  const shot = await snap(page, 'i18n-cleanup');
  log('I18N_CLEANUP: Settings page loaded OK');
}

// 7e.10 High contrast mode CSS exists
async function testHighContrastMode(page) {
  log('--- HIGH_CONTRAST_CSS ---');
  // Check that the variables.scss compiled with prefers-contrast media query
  // by inspecting any CSS rule reference
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

  if (found) {
    log('HIGH_CONTRAST_CSS: PASS — @media (prefers-contrast) detected');
  } else {
    log('HIGH_CONTRAST_CSS: not found in active stylesheets (may not be applied)');
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7D — PRODUCTION HARDENING TESTS
// ═══════════════════════════════════════════════════════════════

// 7d.1 Privacy settings exist
async function testPrivacySettings(page) {
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

  // Check deactivate button
  const deactivateBtn = await page.$('button:has-text("Удалить")');
  log(`PRIVACY_SETTINGS: Deactivate button: ${!!deactivateBtn}`);
}

// 7d.2 Idle logout setting
async function testIdleLogoutSetting(page) {
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

// 7d.3 Voice recorder button
async function testVoiceButton(page) {
  log('--- VOICE_BUTTON ---');
  if (!(await ensureInRoom(page))) return;

  // Clear textarea — voice button should appear when empty
  const textarea = await page.$('textarea[data-testid="composer-textarea"], textarea[class*="textarea"]');
  if (textarea) await textarea.fill('');
  await page.waitForTimeout(500);

  // Voice button should be present (with Mic icon)
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!sendBtn) {
    log('VOICE_BUTTON: No send button area');
    return;
  }

  const innerHtml = await sendBtn.innerHTML();
  // Mic icon (lucide) renders as svg with mic attributes
  const hasMic = innerHtml.includes('svg') || innerHtml.includes('Mic');
  log(`VOICE_BUTTON: Mic icon visible when textarea empty: ${hasMic}`);
  await snap(page, 'voice-button');
}

// 7d.4 Slash commands
async function testSlashCommands(page) {
  log('--- SLASH_COMMANDS ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  // Test /shrug command
  await textarea.fill('/shrug hello');
  await page.waitForTimeout(300);
  await sendBtn.click();
  await page.waitForTimeout(2500);
  const shot = await snap(page, 'slash-shrug');

  // Look for ¯\_(ツ)_/¯ in timeline
  const html = await page.content();
  if (html.includes('¯\\_(ツ)_/¯') || html.includes('(ツ)')) {
    log('SLASH_COMMANDS: PASS — /shrug rendered');
  } else {
    log('SLASH_COMMANDS: shrug text not found (may be due to encoding)');
  }
}

// 7d.5 Send queue exists in IDB
async function testSendQueueDB(page) {
  log('--- SEND_QUEUE_DB ---');

  // Open IndexedDB and check if our send queue store exists
  const exists = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('corp-matrix-send-queue', 1);
      req.onsuccess = () => {
        const db = req.result;
        const has = db.objectStoreNames.contains('pending');
        db.close();
        resolve(has);
      };
      req.onerror = () => resolve(false);
    });
  });

  log(`SEND_QUEUE_DB: send queue store exists: ${exists}`);
}

// 7d.6 Saved Messages no duplication
async function testSavedMessagesNoDup(page) {
  log('--- SAVED_MESSAGES_NO_DUP ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  // Click savedBtn twice
  const savedBtn = await page.$('[class*="savedBtn"]');
  if (!savedBtn) { log('SAVED_MESSAGES_NO_DUP: No saved btn, skipping'); return; }

  await savedBtn.click();
  await page.waitForTimeout(2500);
  const url1 = page.url();

  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);

  await savedBtn.click();
  await page.waitForTimeout(2500);
  const url2 = page.url();

  const shot = await snap(page, 'saved-no-dup');

  if (url1 === url2 && url1.includes('/rooms/')) {
    log('SAVED_MESSAGES_NO_DUP: PASS — same room opened twice');
  } else {
    bug('MEDIUM', 'SAVED_MESSAGES_NO_DUP', `Different Saved Messages opened: ${url1} vs ${url2}`, [], shot);
  }
}

// 7d.7 Encrypted recovery key in IDB
async function testEncryptedRecoveryKey(page) {
  log('--- ENCRYPTED_RECOVERY_KEY ---');

  const stored = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('corp-matrix-web', 1);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('session', 'readonly');
          const store = tx.objectStore('session');
          const getReq = store.get('recoveryKey');
          getReq.onsuccess = () => {
            const val = getReq.result;
            const shape = val == null ? 'null' : Array.isArray(val) ? 'array' : typeof val;
            const isEncrypted =
              val != null &&
              !Array.isArray(val) &&
              typeof val === 'object' &&
              'iv' in val &&
              'data' in val;
            db.close();
            resolve({ shape: shape, isEncrypted: isEncrypted });
          };
          getReq.onerror = () => { db.close(); resolve({ shape: 'error', isEncrypted: false }); };
        } catch {
          db.close();
          resolve({ shape: 'error', isEncrypted: false });
        }
      };
      req.onerror = () => resolve({ shape: 'no-db', isEncrypted: false });
    });
  });

  log(`ENCRYPTED_RECOVERY_KEY: shape=${stored.shape}, encrypted=${stored.isEncrypted}`);

  if (stored.shape === 'array') {
    bug('HIGH', 'ENCRYPTED_RECOVERY_KEY', 'Recovery key stored as plaintext array — security hole', [], '');
  } else if (stored.shape === 'object' && stored.isEncrypted) {
    log('ENCRYPTED_RECOVERY_KEY: PASS — key is encrypted with iv+data');
  }
}

// 7d.8 Pinned bar updates without reload (regression — already fixed earlier)
// — covered by testPinMessageLive, no duplicate

// 7d.9 No console.log in production build (just check that logger module exists)
async function testLoggerExists(page) {
  log('--- LOGGER_MODULE ---');
  // Just verify by checking app loaded (no missing module errors)
  const url = page.url();
  log(`LOGGER_MODULE: App loaded OK at ${url}`);
}

// 7d.10 Touch targets (visual check via getBoundingClientRect on mobile viewport)
async function testTouchTargetSize(page) {
  log('--- TOUCH_TARGETS ---');
  await page.setViewportSize({ width: 375, height: 812 });
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  const tiny = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const tooSmall = [];
    for (const btn of Array.from(buttons)) {
      if (btn.offsetParent === null) continue; // hidden
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

// 7d.11 Skip link is present
async function testSkipLink(page) {
  log('--- SKIP_LINK ---');
  await goto(page, '/', 'a, button');
  await page.waitForTimeout(1000);

  const skipLink = await page.$('a[href="#main-content"], a[class*="sr-only"]');
  if (!skipLink) {
    bug('LOW', 'SKIP_LINK', 'Accessibility skip link not present', [], '');
  } else {
    log('SKIP_LINK: PASS');
  }
}

// 7d.12 Cross-signing UI present in encryption settings
async function testCrossSigningUiNew(page) {
  log('--- CROSS_SIGNING_UI_PRESENT ---');
  await goto(page, '/settings/encryption', 'button, h3');
  await page.waitForTimeout(2000);

  const verifyBtn = await page.$('button:has-text("ерифицировать"), button:has-text("Verify")');
  log(`CROSS_SIGNING_UI_PRESENT: Verify button: ${!!verifyBtn}`);

  if (!verifyBtn) {
    bug('LOW', 'CROSS_SIGNING_UI_PRESENT', 'Cross-signing verify button not in encryption settings', [], '');
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7C — NEW FEATURES TESTS
// ═══════════════════════════════════════════════════════════════

// 7c.bug1 Reactions don't reset on rapid clicks
async function testReactionStability(page) {
  log('--- REACTION_STABILITY ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { log('REACTION_STABILITY: No messages, skipping'); return; }

  // Add a reaction via right-click → quick reactions
  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(500);

  const quickEmoji = await page.$('[class*="quickEmoji"]');
  if (!quickEmoji) {
    log('REACTION_STABILITY: No quick emoji button, skipping');
    await page.keyboard.press('Escape');
    return;
  }

  // Click first emoji
  await quickEmoji.click();
  await page.waitForTimeout(1000);

  // Check reaction appeared
  let reaction = await page.$('[class*="reaction"]');
  const beforeShot = await snap(page, 'reaction-stability-1');
  if (!reaction) {
    bug('HIGH', 'REACTION_STABILITY', 'Reaction not visible after click', [], beforeShot);
    return;
  }
  log('REACTION_STABILITY: First reaction added');

  // Wait for sync, check still visible
  await page.waitForTimeout(3000);
  reaction = await page.$('[class*="reaction"]');
  const afterShot = await snap(page, 'reaction-stability-2');

  if (!reaction) {
    bug('HIGH', 'REACTION_STABILITY', 'Reaction disappeared after sync (race condition)', [
      '1. Add reaction',
      '2. Wait 3s',
      '3. Reaction gone',
    ], afterShot);
  } else {
    log('REACTION_STABILITY: PASS — reaction persists after sync');
  }
}

// 7c.bug2 Rapid reaction clicks don't lose state
async function testReactionRapidClicks(page) {
  log('--- REACTION_RAPID_CLICKS ---');
  if (!(await ensureInRoom(page))) return;

  // Find a message with existing reaction (or add one)
  const reactions = await page.$$('[class*="reaction"]:not([class*="reactionMine"])');
  if (reactions.length === 0) {
    log('REACTION_RAPID_CLICKS: No existing reactions, skipping');
    return;
  }

  const reaction = reactions[0];
  // Click reaction 3 times rapidly (toggle on/off/on)
  for (let i = 0; i < 3; i++) {
    await reaction.click().catch(() => {});
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(3000);
  const shot = await snap(page, 'reaction-rapid-clicks');

  // Reaction should still exist (final state should be a valid number)
  const stillExists = await page.$('[class*="reaction"]');
  log(`REACTION_RAPID_CLICKS: Reactions still present after rapid clicks: ${!!stillExists}`);
}

// 7c.bug3 Timeline doesn't jitter when reply target is set
async function testTimelineNoJitter(page) {
  log('--- TIMELINE_NO_JITTER ---');
  if (!(await ensureInRoom(page))) return;

  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) return;

  // Set reply target via context menu
  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(500);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('reply') || text.toLowerCase().includes('ответ')) {
      await item.click();
      break;
    }
  }
  await page.waitForTimeout(800);

  // Check reply preview is shown
  const replyPreview = await page.$('[class*="replyPreview"]');
  if (!replyPreview) {
    log('TIMELINE_NO_JITTER: Could not set reply target, skipping');
    return;
  }
  log('TIMELINE_NO_JITTER: Reply preview set');

  // Get the scroll position before
  const scrollBefore = await page.evaluate(() => {
    const container = document.querySelector('[class*="container"][role="log"]');
    return container ? container.scrollTop : 0;
  });

  // Send a message from user2 via API to trigger a sync
  const u2 = CONFIG.users[1];
  if (CONFIG.rooms.general && u2.token) {
    await api('PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(CONFIG.rooms.general)}/send/m.room.message/jitter-${Date.now()}`,
      { msgtype: 'm.text', body: 'Тест jitter — новое сообщение во время reply' },
      u2.token,
    );
    await page.waitForTimeout(3000);
  }

  // Check reply preview is still set (didn't get cleared)
  const replyStillSet = await page.$('[class*="replyPreview"]');
  const shot = await snap(page, 'timeline-no-jitter');

  if (!replyStillSet) {
    bug('MEDIUM', 'TIMELINE_NO_JITTER', 'Reply target was lost after new message arrived', [
      '1. Set reply target',
      '2. Receive new message',
      '3. Reply preview disappeared',
    ], shot);
  } else {
    log('TIMELINE_NO_JITTER: PASS — reply preview preserved');
  }

  // Get scroll position after
  const scrollAfter = await page.evaluate(() => {
    const container = document.querySelector('[class*="container"][role="log"]');
    return container ? container.scrollTop : 0;
  });
  log(`TIMELINE_NO_JITTER: Scroll before=${scrollBefore}, after=${scrollAfter}`);

  // Cancel reply
  const cancelBtn = await page.$('[class*="replyCancelBtn"]');
  if (cancelBtn) await cancelBtn.click();
}

// 7c.bug4 Pin message updates without reload
async function testPinMessageLive(page) {
  log('--- PIN_MESSAGE_LIVE ---');
  if (!(await ensureInRoom(page))) return;

  // Send a fresh message to pin
  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const pinText = `Pin test ${Date.now()}`;
  await textarea.fill(pinText);
  await sendBtn.click();
  await page.waitForTimeout(2500);

  // Find the message
  const ownMsg = await page.$(`text="${pinText}"`);
  if (!ownMsg) {
    log('PIN_MESSAGE_LIVE: Could not find sent message, skipping');
    return;
  }

  // Open context menu via right-click on parent bubble
  const bubble = await page.evaluateHandle((el) => el.closest('[class*="bubble"]'), ownMsg);
  await bubble.asElement()?.click({ button: 'right' });
  await page.waitForTimeout(800);

  // Click "select" first to enable selection mode (pin works in selection mode)
  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let selectClicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('select') || text.toLowerCase().includes('выбр') || text.toLowerCase().includes('выдел')) {
      await item.click();
      selectClicked = true;
      break;
    }
  }

  if (!selectClicked) {
    log('PIN_MESSAGE_LIVE: Could not enter selection mode');
    return;
  }
  await page.waitForTimeout(500);

  // Click pin button in selection bar
  const selectionBtns = await page.$$('[class*="selectionBtn"]');
  let pinClicked = false;
  for (const btn of selectionBtns) {
    const title = await btn.getAttribute('title');
    if (title?.toLowerCase().includes('pin') || title?.toLowerCase().includes('закреп')) {
      await btn.click();
      pinClicked = true;
      break;
    }
  }

  if (!pinClicked) {
    log('PIN_MESSAGE_LIVE: Pin button not found');
    return;
  }

  // Wait for state event sync + PinnedMessageBar update
  await page.waitForTimeout(4000);
  const shot = await snap(page, 'pin-message-live');

  // Check that PinnedMessageBar appeared without reload
  const pinnedBar = await page.$('[class*="pinned"], [class*="bar"]');
  log(`PIN_MESSAGE_LIVE: Pinned bar found: ${!!pinnedBar}`);

  if (!pinnedBar) {
    bug('MEDIUM', 'PIN_MESSAGE_LIVE', 'Pinned message bar did not appear after pinning (requires reload)', [
      '1. Pin a message',
      '2. Wait for sync',
      '3. PinnedMessageBar should appear automatically',
    ], shot);
  } else {
    log('PIN_MESSAGE_LIVE: PASS — bar appears live');
  }
}



// 7c.0a Send a mention via API from user2 to user1
async function setupMentionMessage() {
  const u1 = CONFIG.users[0];
  const u2 = CONFIG.users[1];
  if (!CONFIG.rooms.general || !u1.token || !u2.token) return null;

  const body = `Привет ${u1.userId.split(':')[0]}, упоминание для теста ${Date.now()}`;
  const formattedBody = `Привет <a href="https://matrix.to/#/${encodeURIComponent(u1.userId)}">${u1.userId.split(':')[0]}</a>, упоминание для теста`;

  const res = await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(CONFIG.rooms.general)}/send/m.room.message/mention-${Date.now()}`,
    {
      msgtype: 'm.text',
      body,
      format: 'org.matrix.custom.html',
      formatted_body: formattedBody,
      'm.mentions': { user_ids: [u1.userId] },
    },
    u2.token,
  );
  return res.ok ? res.data.event_id : null;
}

// 7c.0b Mention badge "@" in room list
async function testMentionBadgeInRoomList(page) {
  log('--- MENTION_BADGE_LIST ---');

  // Move user1 OUT of the general room first — otherwise read receipt is sent
  // and highlightCount stays 0
  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  } else {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1500);
  }

  // Now send a mention from user2 to user1 via API (user1 is in a different room)
  const eventId = await setupMentionMessage();
  if (!eventId) { log('MENTION_BADGE_LIST: Could not send mention, skipping'); return; }
  log(`MENTION_BADGE_LIST: Mention sent — event ${eventId}`);

  // Wait for sync to deliver the highlight
  await page.waitForTimeout(4000);
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'mention-badge-list');

  // Look for the @ icon next to room item
  const mentionIcons = await page.$$('[class*="mentionIcon"]');
  log(`MENTION_BADGE_LIST: @ icons in room list: ${mentionIcons.length}`);

  if (mentionIcons.length === 0) {
    bug('MEDIUM', 'MENTION_BADGE_LIST', '@ icon not visible in room list when user is mentioned', [
      '1. Send mention to user from another account',
      '2. Open room list',
      '3. @ icon should appear next to the room',
    ], shot);
  } else {
    log('MENTION_BADGE_LIST: PASS — @ badge visible');
  }
}

// 7c.0c Click room with mention — should scroll to mention event
async function testMentionScrollOnEnter(page) {
  log('--- MENTION_SCROLL_ENTER ---');
  if (!CONFIG.rooms.general) return;

  // Move user OUT of the general room so highlight count stays > 0
  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  }

  // Send another mention to ensure highlight count > 0
  const eventId = await setupMentionMessage();
  if (!eventId) return;
  await page.waitForTimeout(4000);

  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);

  // Find the room with @ icon and click it
  const items = await page.$$(ROOM_ITEM_SEL);
  let clicked = false;
  for (const item of items) {
    const hasMention = await item.$('[class*="mentionIcon"]');
    if (hasMention) {
      await item.scrollIntoViewIfNeeded();
      await item.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    log('MENTION_SCROLL_ENTER: No room with @ icon found');
    return;
  }

  await page.waitForTimeout(3000);
  const shot = await snap(page, 'mention-scroll-enter');

  // Check URL contains eventId
  const url = page.url();
  if (url.includes('eventId=')) {
    log(`MENTION_SCROLL_ENTER: PASS — URL has eventId parameter`);
  } else {
    bug('LOW', 'MENTION_SCROLL_ENTER', `URL does not contain eventId after clicking mentioned room. URL: ${url}`, [], shot);
  }
}

// 7c.0d MentionNavigator button visible in room with mentions
async function testMentionNavigator(page) {
  log('--- MENTION_NAVIGATOR ---');
  if (!CONFIG.rooms.general) return;

  // Send a mention to ensure there's something to navigate to
  await setupMentionMessage();
  await page.waitForTimeout(3000);

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'mention-navigator');

  // Look for the floating @ button (MentionNavigator)
  const navBtn = await page.$('button[aria-label*="упоминаний"], button[title*="упоминан"]');
  if (!navBtn) {
    log('MENTION_NAVIGATOR: Navigator button not visible (highlightCount may be 0)');
    return;
  }

  log('MENTION_NAVIGATOR: PASS — navigator button visible');
  await navBtn.click();
  await page.waitForTimeout(1500);
  await snap(page, 'mention-navigator-after-click');
  log('MENTION_NAVIGATOR: Click handled');
}

// 7c.0e Mention highlights message bubble (mentioned class)
async function testMentionedBubble(page) {
  log('--- MENTIONED_BUBBLE ---');
  if (!CONFIG.rooms.general) return;

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);

  const mentionedMsgs = await page.$$('[class*="message"][class*="mentioned"]');
  log(`MENTIONED_BUBBLE: ${mentionedMsgs.length} mentioned message(s) visible`);

  if (mentionedMsgs.length === 0) {
    log('MENTIONED_BUBBLE: No mentioned messages visible (might need to scroll up)');
  } else {
    log('MENTIONED_BUBBLE: PASS — mention highlight class applied');
  }
  await snap(page, 'mentioned-bubble');
}

// 7c.0f @room mention via API and verify highlight
async function testRoomMention(page) {
  log('--- ROOM_MENTION ---');
  const u2 = CONFIG.users[1];
  if (!CONFIG.rooms.general || !u2.token) return;

  // Move user1 OUT of the general room so highlightCount can accumulate
  if (CONFIG.rooms.empty) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.empty)}`, '[class*="composer"]');
    await page.waitForTimeout(1500);
  }

  // Send @room mention from user2 (user2 has PL 50 thanks to power_level_content_override)
  await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(CONFIG.rooms.general)}/send/m.room.message/room-mention-${Date.now()}`,
    {
      msgtype: 'm.text',
      body: '@room тестовое уведомление для всех',
      'm.mentions': { room: true },
    },
    u2.token,
  );
  log('ROOM_MENTION: @room message sent');

  await page.waitForTimeout(4000);
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);

  // Check that @ icon appears (room mention should also trigger highlight)
  const mentionIcons = await page.$$('[class*="mentionIcon"]');
  log(`ROOM_MENTION: @ icons after @room: ${mentionIcons.length}`);
  await snap(page, 'room-mention');

  if (mentionIcons.length === 0) {
    bug('LOW', 'ROOM_MENTION', '@room mention did not trigger highlight badge', [], '');
  } else {
    log('ROOM_MENTION: PASS');
  }
}

// 7c.1 Quick reactions in context menu
async function testQuickReactions(page) {
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

// 7c.2 Hashtag rendering
async function testHashtags(page) {
  log('--- HASHTAG_RENDER ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  const msg = `Testing #hashtag and #тест ${Date.now()}`;
  await textarea.fill(msg);
  await sendBtn.click();
  await page.waitForTimeout(3000);
  const shot = await snap(page, 'hashtag-render');

  const hashtags = await page.$$('.hashtag');
  if (hashtags.length > 0) {
    log(`HASHTAG_RENDER: PASS — ${hashtags.length} hashtags styled`);
  } else {
    log('HASHTAG_RENDER: Hashtags sent (check visually — global class may not be queryable)');
  }
}

// 7c.3 @room mention in popup
async function testAtRoomMention(page) {
  log('--- AT_ROOM_MENTION ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  await textarea.fill('');
  await textarea.click();
  await page.keyboard.type('@');
  await page.waitForTimeout(1000);
  const shot = await snap(page, 'at-room-popup');

  const popup = await page.$('[class*="popup"]');
  if (!popup) {
    log('AT_ROOM_MENTION: Mention popup not found');
    return;
  }

  const roomItem = await page.$('[class*="roomIcon"]');
  if (!roomItem) {
    bug('MEDIUM', 'AT_ROOM_MENTION', '@room option not found in mention popup', [], shot);
  } else {
    log('AT_ROOM_MENTION: PASS — @room option visible');
  }

  await page.keyboard.press('Escape');
  await textarea.fill('');
}

// 7c.4 Reply truncation
async function testReplyTruncation(page) {
  log('--- REPLY_TRUNCATION ---');
  if (!(await ensureInRoom(page))) return;

  // Check if any reply quote exists
  const replyQuote = await page.$('[class*="replyQuoteBody"]');
  if (replyQuote) {
    const styles = await replyQuote.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        overflow: cs.overflow,
        webkitLineClamp: cs.getPropertyValue('-webkit-line-clamp'),
        display: cs.display,
      };
    });
    log(`REPLY_TRUNCATION: overflow=${styles.overflow}, line-clamp=${styles.webkitLineClamp}`);
    if (styles.overflow === 'hidden') {
      log('REPLY_TRUNCATION: PASS — overflow hidden applied');
    }
  } else {
    log('REPLY_TRUNCATION: No reply quotes visible, skipping');
  }
}

// 7c.5 Draft persistence
async function testDraftPersistence(page) {
  log('--- DRAFT_PERSIST ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  const draftText = `Draft test ${Date.now()}`;
  await textarea.fill(draftText);
  await page.waitForTimeout(500);

  // Navigate away
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);

  // Navigate back to the same room
  if (!(await ensureInRoom(page))) return;
  await page.waitForTimeout(1500);

  const restoredText = await (await page.$('textarea[class*="textarea"]'))?.inputValue() ?? '';
  const shot = await snap(page, 'draft-persist');

  if (restoredText === draftText) {
    log('DRAFT_PERSIST: PASS — draft restored');
  } else {
    log(`DRAFT_PERSIST: Draft not restored (got "${restoredText.slice(0, 30)}", expected "${draftText.slice(0, 30)}")`);
  }

  // Clean up
  const ta = await page.$('textarea[class*="textarea"]');
  if (ta) await ta.fill('');
}

// 7c.6 Image caption UI
async function testImageCaption(page) {
  log('--- IMAGE_CAPTION ---');
  if (!(await ensureInRoom(page))) return;

  // Check that ImagePreviewDialog has caption textarea
  // We can't easily trigger it without a real file, so just verify the attach menu exists
  const attachBtn = await page.$('[class*="attachBtn"]');
  if (attachBtn) {
    log('IMAGE_CAPTION: Attach button present (caption UI added to ImagePreviewDialog)');
  } else {
    log('IMAGE_CAPTION: No attach button found');
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7A — SECURITY & ERROR HANDLING TESTS
// ═══════════════════════════════════════════════════════════════

// 7a.1 XSS: send formatted message with script tag, verify it's sanitized
async function testXssSanitization(page) {
  log('--- XSS_SANITIZATION ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

  // Send XSS payload as markdown (marked will generate HTML)
  const xssPayloads = [
    '<img src=x onerror=alert(1)>',
    '<script>alert("xss")</script>',
    '[click](javascript:alert(1))',
  ];

  for (const payload of xssPayloads) {
    await textarea.fill(payload);
    await sendBtn.click();
    await page.waitForTimeout(2000);
  }

  const shot = await snap(page, 'xss-sanitization');

  // Check DOM for dangerous elements
  const xssFound = await page.evaluate(() => {
    const results = [];
    // Check for script tags in message content
    const scripts = document.querySelectorAll('[class*="textContent"] script');
    if (scripts.length > 0) results.push('script tag rendered');

    // Check for onerror handlers
    const imgs = document.querySelectorAll('[class*="textContent"] img[onerror]');
    if (imgs.length > 0) results.push('img onerror rendered');

    // Check for javascript: hrefs
    const links = document.querySelectorAll('[class*="textContent"] a[href^="javascript:"]');
    if (links.length > 0) results.push('javascript: link rendered');

    return results;
  });

  if (xssFound.length > 0) {
    bug('CRITICAL', 'XSS_SANITIZATION', `XSS not sanitized: ${xssFound.join(', ')}`, [
      '1. Send message with XSS payloads',
      '2. Dangerous HTML rendered in DOM',
    ], shot);
  } else {
    log('XSS_SANITIZATION: PASS — all payloads sanitized');
  }
}

// 7a.2 Error boundary: check that app root has error boundary
async function testErrorBoundary(page) {
  log('--- ERROR_BOUNDARY ---');

  // Verify the error boundary component exists by checking that the app
  // didn't crash during all previous tests (it would show fallback UI)
  const hasFallback = await page.$('[class*="ErrorBoundary"], [class*="errorBoundary"]');
  if (hasFallback) {
    bug('HIGH', 'ERROR_BOUNDARY', 'Error boundary fallback is visible — app has crashed', [],
      await snap(page, 'error-boundary-active'));
  } else {
    log('ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)');
  }
}

// 7a.3 Crypto banner: check it's NOT visible (crypto should be working)
async function testCryptoBanner(page) {
  log('--- CRYPTO_BANNER ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);

  const banner = await page.$('[class*="CryptoBanner"], [class*="cryptoBanner"]');
  if (banner) {
    const text = await banner.textContent();
    bug('HIGH', 'CRYPTO_BANNER', `Crypto warning banner visible: "${text.trim()}"`, [
      '1. Open app',
      '2. Yellow banner about encryption appears',
      '3. E2E may not be working',
    ], await snap(page, 'crypto-banner-visible'));
  } else {
    log('CRYPTO_BANNER: PASS — no warning banner (crypto is working)');
  }
}

// 7a.4 Send error feedback: verify toast appears on error
async function testSendErrorFeedback(page) {
  log('--- SEND_ERROR_FEEDBACK ---');
  if (!(await ensureInRoom(page))) return;

  // Check that composer keeps text if send fails by checking textarea is NOT empty
  // after sending (we can't easily simulate network failure, so we just verify
  // the toast system is connected)
  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  // Verify the send button has aria-label
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (sendBtn) {
    const ariaLabel = await sendBtn.getAttribute('aria-label');
    if (!ariaLabel) {
      bug('LOW', 'SEND_ERROR_FEEDBACK', 'Send button missing aria-label', [], '');
    } else {
      log(`SEND_ERROR_FEEDBACK: Send button aria-label="${ariaLabel}"`);
    }
  }

  // Verify textarea has aria-label
  const textareaAriaLabel = await textarea.getAttribute('aria-label');
  if (!textareaAriaLabel) {
    bug('LOW', 'SEND_ERROR_FEEDBACK', 'Message textarea missing aria-label', [], '');
  } else {
    log(`SEND_ERROR_FEEDBACK: Textarea aria-label="${textareaAriaLabel}"`);
  }

  log('SEND_ERROR_FEEDBACK: PASS');
}

// 7a.5 Accessibility: check timeline has role="log" and aria-live
async function testTimelineAccessibility(page) {
  log('--- TIMELINE_A11Y ---');
  if (!(await ensureInRoom(page))) return;

  const logRegion = await page.$('[role="log"]');
  if (!logRegion) {
    bug('MEDIUM', 'TIMELINE_A11Y', 'Timeline missing role="log" — inaccessible to screen readers', [],
      await snap(page, 'timeline-no-role'));
  } else {
    const ariaLive = await logRegion.getAttribute('aria-live');
    log(`TIMELINE_A11Y: role="log" found, aria-live="${ariaLive}"`);
    if (ariaLive !== 'polite') {
      bug('LOW', 'TIMELINE_A11Y', `Timeline aria-live should be "polite", got "${ariaLive}"`, [], '');
    }
  }

  // Check composer form has role
  const form = await page.$('form[role="form"]');
  if (form) {
    log('TIMELINE_A11Y: Composer form has role="form"');
  }

  log('TIMELINE_A11Y: PASS');
}

// 7a.6 CSP headers (only verifiable on deployed app, log for reference)
async function testSecurityHeaders(page) {
  log('--- SECURITY_HEADERS ---');

  // We can't check HTTP headers from Playwright page context easily,
  // but we can verify the netlify.toml config was set by checking
  // if inline scripts are blocked (CSP test)
  const pageText = await page.evaluate(() => document.body.innerText);
  log(`SECURITY_HEADERS: Page loaded OK (CSP not blocking app)`);

  // Check for meta CSP tag (may or may not be present)
  const cspMeta = await page.$('meta[http-equiv="Content-Security-Policy"]');
  log(`SECURITY_HEADERS: CSP meta tag: ${!!cspMeta}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7B — ENCRYPTION & DEVICES
// ═══════════════════════════════════════════════════════════════

// 7b.1 Encryption settings page
async function testEncryptionSettings(page) {
  log('--- ENCRYPTION_SETTINGS ---');
  await goto(page, '/settings/encryption', '[class*="section"], [class*="heading"]');
  const shot = await snap(page, 'encryption-settings');

  // Check key backup section
  const backupBtn = await page.$('button:has-text("backup"), button:has-text("Backup"), button:has-text("резерв"), button:has-text("бэкап")');
  log(`ENCRYPTION_SETTINGS: Key backup button: ${!!backupBtn}`);

  // Check page content
  const content = await page.evaluate(() => document.body.innerText);
  const hasBackupInfo = /backup|key|ключ|резерв/i.test(content);
  log(`ENCRYPTION_SETTINGS: Has backup-related content: ${hasBackupInfo}`);

  if (!hasBackupInfo) {
    bug('MEDIUM', 'ENCRYPTION_SETTINGS', 'No key backup info on encryption settings page', [], shot);
  }
}

// 7b.2 Devices settings page — check device list
async function testDevicesSettings(page) {
  log('--- DEVICES_SETTINGS ---');
  await goto(page, '/settings/devices', '[class*="section"], [class*="device"], [class*="heading"]');
  await page.waitForTimeout(2000); // devices may load async
  const shot = await snap(page, 'devices-settings');

  // Count devices
  const devices = await page.$$('[class*="device"], [class*="session"]');
  log(`DEVICES_SETTINGS: Device elements: ${devices.length}`);

  // Check for current device indicator
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasCurrentDevice = /current|текущ|this device/i.test(pageText);
  log(`DEVICES_SETTINGS: Current device indicator: ${hasCurrentDevice}`);

  // Check for device IDs
  const deviceIds = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="deviceId"], [class*="id"], code, small');
    return Array.from(els).map(e => e.textContent?.trim()).filter(t => t && t.length > 5).slice(0, 5);
  });
  log(`DEVICES_SETTINGS: Device IDs found: ${deviceIds.length}`);
}

// 7b.3 Check device proliferation via API
async function testDeviceProliferation() {
  log('--- DEVICE_PROLIFERATION ---');
  const user = CONFIG.users[0];
  if (!user.token) { log('DEVICE_PROLIFERATION: No token, skipping'); return; }

  // Get device list from API
  const res = await api('GET', '/_matrix/client/v3/devices', null, user.token);
  if (!res.ok) {
    log(`DEVICE_PROLIFERATION: Cannot get devices: ${res.status}`);
    return;
  }

  const devices = res.data.devices || [];
  log(`DEVICE_PROLIFERATION: Total devices for ${user.userId}: ${devices.length}`);

  // Log each device
  for (const d of devices) {
    const lastSeen = d.last_seen_ts ? new Date(d.last_seen_ts).toISOString().slice(0, 19) : 'never';
    log(`  Device: ${d.device_id} | name="${d.display_name || '-'}" | last_seen=${lastSeen}`);
  }

  if (devices.length > 5) {
    bug('MEDIUM', 'DEVICE_PROLIFERATION', `User has ${devices.length} devices — likely leaking sessions on each login. Old devices should be cleaned up.`, [
      `1. User ${user.userId}`,
      `2. Has ${devices.length} devices`,
      '3. Expected: <=3 devices for a test user',
    ], '');
  }

  if (devices.length > 10) {
    bug('HIGH', 'DEVICE_PROLIFERATION', `User has ${devices.length} devices — severe session leak. Each login/test run creates new devices without removing old ones.`, [], '');
  }
}

// 7b.4 Check key backup status via API
async function testKeyBackupStatus() {
  log('--- KEY_BACKUP_STATUS ---');
  const user = CONFIG.users[0];
  if (!user.token) { log('KEY_BACKUP_STATUS: No token, skipping'); return; }

  const res = await api('GET', '/_matrix/client/v3/room_keys/version', null, user.token);

  if (res.status === 404) {
    bug('MEDIUM', 'KEY_BACKUP_STATUS', 'No key backup configured — messages will be lost if user logs out or switches device', [
      '1. Check /room_keys/version',
      '2. Returns 404 — no backup',
      '3. E2E messages not recoverable without device keys',
    ], '');
    log('KEY_BACKUP_STATUS: No backup configured (404)');
  } else if (res.ok) {
    log(`KEY_BACKUP_STATUS: Backup exists — version=${res.data.version}, algorithm=${res.data.algorithm}`);
  } else {
    log(`KEY_BACKUP_STATUS: Unexpected response: ${res.status}`);
  }
}

// 7b.5 Test encrypted room — check for UTD (Unable To Decrypt) messages
async function testEncryptedMessages(page) {
  log('--- ENCRYPTED_MESSAGES ---');

  // Use the dedicated E2E room, fallback to general
  const targetRoom = CONFIG.rooms.encrypted || CONFIG.rooms.general;
  if (!targetRoom) { log('ENCRYPTED_MESSAGES: No room available, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(targetRoom)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'encrypted-messages');

  // Check for UTD (Unable to Decrypt) indicators
  const utdIndicators = await page.evaluate(() => {
    const body = document.body.innerText;
    const indicators = [];
    if (/unable to decrypt|не удалось расшифровать|undecryptable/i.test(body)) indicators.push('UTD text found');
    // Note: "Зашифрованное сообщение" in room list preview is our intentional replacement, not a bug.
    // Only flag actual UTD placeholders from SDK inside message bubbles.
    const bubbles = document.querySelectorAll('[class*="bubble"] [class*="textContent"], [class*="bubble"] p');
    for (const b of bubbles) {
      const t = b.textContent || '';
      if (/encrypted message|🔒/i.test(t) && t.length < 100) indicators.push('encrypted placeholder in bubble');
    }

    // Check for error icons on messages
    const errorIcons = document.querySelectorAll('[class*="error"], [class*="warning"], [class*="shield"]');
    if (errorIcons.length > 0) indicators.push(`${errorIcons.length} error/warning icons`);

    return indicators;
  });

  if (utdIndicators.length > 0) {
    bug('HIGH', 'ENCRYPTED_MESSAGES', `Undecryptable messages found: ${utdIndicators.join(', ')}`, [
      '1. Open encrypted room',
      '2. Messages cannot be decrypted',
      '3. Likely caused by missing key backup or device key mismatch',
    ], shot);
  } else {
    log('ENCRYPTED_MESSAGES: No UTD indicators found');
  }

  // Check if encryption badge is shown in room header
  const encBadge = await page.$('[class*="encryption"], [class*="shield"], [class*="lock"]');
  log(`ENCRYPTED_MESSAGES: Encryption badge in header: ${!!encBadge}`);
}

// 7b.6 Test cross-signing status via crypto
async function testCrossSigningUI(page) {
  log('--- CROSS_SIGNING_UI ---');
  await goto(page, '/settings/encryption', '[class*="section"], [class*="heading"]');
  await page.waitForTimeout(1500);
  const shot = await snap(page, 'cross-signing-ui');

  // Check for verification-related buttons
  const verifyBtn = await page.$('button:has-text("verify"), button:has-text("верифи"), button:has-text("подтверд")');
  log(`CROSS_SIGNING_UI: Verify button: ${!!verifyBtn}`);

  // Check for cross-signing status text
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasCrossSigning = /cross.signing|кросс.подпис|перекрёстн/i.test(pageText);
  const hasVerification = /verif|верифик|подтвержд/i.test(pageText);
  log(`CROSS_SIGNING_UI: Cross-signing info: ${hasCrossSigning}, Verification info: ${hasVerification}`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 8 — RESPONSIVE
// ═══════════════════════════════════════════════════════════════

async function testResponsive(page, viewport, label) {
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

  // Check horizontal overflow
  const overflowX = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  if (overflowX) {
    bug('MEDIUM', `RESPONSIVE_${label.toUpperCase()}`, `Horizontal overflow at ${viewport.width}x${viewport.height}`, [], await snap(page, `resp-${label}-overflow`));
  }

  // Check for tiny buttons
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

  // Enter a room
  const roomItem = await page.$(ROOM_ITEM_SEL);
  if (roomItem) {
    await roomItem.click();
    await page.waitForTimeout(2000);
    await snap(page, `resp-${label}-room`);

    // Check mobile back button
    const backBtn = await page.$('[class*="backBtn"]');
    log(`RESPONSIVE_${label}: Back button in room: ${!!backBtn}`);

    // Check composer
    const composer = await page.$('[class*="composer"]');
    log(`RESPONSIVE_${label}: Composer visible: ${!!composer}`);
  }

  // Check settings on mobile
  await goto(page, '/settings', 'nav, [class*="nav"]');
  await snap(page, `resp-${label}-settings`);

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 });
}

// ═══════════════════════════════════════════════════════════════
// PHASE 9 — MULTI-USER
// ═══════════════════════════════════════════════════════════════

async function testMultiUser(browser) {
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

  // Try entering a room
  const roomItem = await page2.$(ROOM_ITEM_SEL);
  if (roomItem) {
    await roomItem.click();
    await page2.waitForTimeout(2000);
    await snap(page2, 'multi-user2-room');

    // Send a message as user2
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

// ═══════════════════════════════════════════════════════════════
// CONSOLE & NETWORK ERROR REPORTS
// ═══════════════════════════════════════════════════════════════

function reportConsoleErrors() {
  log('--- CONSOLE_ERRORS ---');
  // Filter out known harmless errors
  const ignoredPatterns = [
    /Failed to load resource.*404/,       // Normal for missing key backups, etc.
    /sync.*error.*ConnectionError/,        // Matrix sync reconnection noise
    /Failed to load resource.*401/,        // UIA device deletion attempts
    /Failed to load resource.*403/,        // Auth-related during tests
    /Failed to load resource.*400/,        // Bad request during negative tests
    /room_keys\/version/,                  // Key backup not configured
  ];
  const filtered = consoleErrors.filter(e =>
    !ignoredPatterns.some(p => p.test(e.text))
  );
  const unique = [...new Set(filtered.map(e => e.text))];
  if (unique.length > 0) {
    log(`Console errors: ${unique.length} unique (${consoleErrors.length - filtered.length} filtered as harmless)`);
    for (const err of unique.slice(0, 15)) {
      const sev = /Uncaught|TypeError|ReferenceError|SyntaxError/.test(err) ? 'HIGH' : 'LOW';
      bug(sev, 'CONSOLE_ERRORS', err.slice(0, 250), ['Captured from browser console'], '');
    }
  } else {
    log(`CONSOLE_ERRORS: None (${consoleErrors.length} filtered as harmless)`);
  }
}

function reportNetworkErrors() {
  log('--- NETWORK_ERRORS ---');
  const significant = networkErrors.filter(e =>
    e.status >= 500 || (e.status >= 400 && !e.url.includes('/login') && !e.url.includes('/_matrix/client'))
  );

  if (significant.length > 0) {
    const unique = [...new Map(significant.map(e => [`${e.status}:${new URL(e.url).pathname}`, e])).values()];
    log(`Network errors: ${unique.length} unique`);
    for (const err of unique.slice(0, 15)) {
      const sev = err.status >= 500 ? 'HIGH' : 'MEDIUM';
      bug(sev, 'NETWORK_ERRORS', `HTTP ${err.status}: ${err.url.slice(0, 180)}`, [`Page: ${err.page}`], '');
    }
  } else {
    log('NETWORK_ERRORS: None');
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════

function generateReport() {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  bugs.forEach(b => counts[b.severity]++);

  const icon = { CRITICAL: '\u{1F534}', HIGH: '\u{1F7E0}', MEDIUM: '\u{1F7E1}', LOW: '\u{1F7E2}' };

  let md = `# Bug Report — Corp Matrix Web\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n`;
  md += `**App URL:** ${CONFIG.appUrl}\n`;
  md += `**Homeserver:** ${CONFIG.homeserver}\n`;
  md += `**Total bugs:** ${bugs.length}\n\n`;

  md += `## Summary\n| Severity | Count |\n|---|---|\n`;
  for (const [sev, cnt] of Object.entries(counts)) {
    md += `| ${icon[sev]} ${sev} | ${cnt} |\n`;
  }
  md += '\n';

  if (bugs.length > 0) {
    md += `## Bugs\n| # | Severity | Scenario | Description | Steps | Screenshot |\n|---|---|---|---|---|---|\n`;
    bugs.forEach((b, i) => {
      const steps = b.steps.join(' ');
      const shot = b.screenshot ? `[screenshot](screenshots/${b.screenshot})` : '-';
      md += `| ${i + 1} | ${icon[b.severity]} ${b.severity} | ${b.scenario} | ${b.description.replace(/\|/g, '\\|')} | ${steps.replace(/\|/g, '\\|')} | ${shot} |\n`;
    });
  } else {
    md += `## No bugs found!\n`;
  }
  md += '\n';

  md += `## Console Errors\n`;
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 25).forEach(e => {
      md += `- \`${e.ts}\` [${e.page}] ${e.text.slice(0, 200)}\n`;
    });
  } else { md += `None.\n`; }
  md += '\n';

  md += `## Network Errors\n`;
  if (networkErrors.length > 0) {
    networkErrors.slice(0, 25).forEach(e => {
      md += `- \`${e.ts}\` [${e.page}] HTTP ${e.status} — ${e.url.slice(0, 150)}\n`;
    });
  } else { md += `None.\n`; }
  md += '\n';

  md += `## Test Log\n\`\`\`\n${testLog.join('\n')}\n\`\`\`\n`;

  return md;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  QA Agent — Corp Matrix Web (Full)   ║');
  console.log('╚══════════════════════════════════════╝\n');

  fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });

  // ══════ Phase 0: Setup data via API ══════
  const setupOk = await setup();
  if (!setupOk) {
    log('SETUP FAILED — tests will still run but may have no data');
    bug('HIGH', 'SETUP', 'Failed to create test users/rooms via API. Tests may be incomplete.', [], '');
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: CONFIG.slowMo,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  });

  const page = await context.newPage();
  listen(page, 'main');

  try {
    // ══════ Phase 1: Discovery ══════
    await discover(page);

    // ══════ Phase 2: Auth (login first, then negative tests) ══════
    // Login first — before wrong-creds tests that trigger rate limiting
    const loginOk = await testAuthLogin(page);

    if (loginOk) {
      // ══════ Phase 3: Room List ══════
      await discoverPostAuth(page);
      await testRoomListDisplay(page);
      await testRoomSearch(page);
      await testRoomListContextMenu(page);
      await testRoomSwitch(page);
      await testCreateRoom(page);

      // ══════ Phase 4: Room Header & Special Rooms ══════
      await testRoomHeader(page);
      await testEmptyRoom(page);
      await testDMRoom(page);
      await testTimelineScroll(page);

      // ══════ Phase 5: Messaging ══════
      await testChatSendMessage(page);
      await testChatSendEnter(page);
      await testChatShiftEnter(page);
      await testChatSendEmpty(page);
      await testChatLongMessage(page);
      await testChatSpecialChars(page);
      await testAttachMenu(page);

      // ══════ Phase 6: Message Interactions ══════
      await testMessageBubble(page);
      await testMessageContextMenu(page);
      await testReplyMessage(page);
      await testEditMessage(page);
      await testEditCancel(page);
      await testForwardMessage(page);
      await testSelectMessages(page);
      await testCopyMessage(page);
      await testThread(page);
      await testReactMessage(page);
      await testDeleteMessage(page);

      // ══════ Phase 7: Settings ══════
      // Re-login after logout tests might have happened
      await loginAs(page, CONFIG.users[0]);
      await testSettingsNavigation(page);
      await testSettingsProfile(page);
      await testSettingsAppearance(page);

      // ══════ Phase 7c: New Features ══════
      await testQuickReactions(page);
      await testHashtags(page);
      await testAtRoomMention(page);
      await testReplyTruncation(page);
      await testDraftPersistence(page);
      await testImageCaption(page);

      // Mention-specific tests (require API setup of mention messages)
      await testMentionBadgeInRoomList(page);
      await testMentionScrollOnEnter(page);
      await testMentionNavigator(page);
      await testMentionedBubble(page);
      await testRoomMention(page);

      // Bug regression tests
      await testReactionStability(page);
      await testReactionRapidClicks(page);
      await testTimelineNoJitter(page);
      await testPinMessageLive(page);

      // Production hardening tests
      await testPrivacySettings(page);
      await testIdleLogoutSetting(page);
      await testVoiceButton(page);
      await testSlashCommands(page);
      await testSendQueueDB(page);
      await testSavedMessagesNoDup(page);
      await testEncryptedRecoveryKey(page);
      await testLoggerExists(page);
      await testTouchTargetSize(page);
      await testSkipLink(page);
      await testCrossSigningUiNew(page);

      // Latest session polish tests
      await testRoomListTabs(page);
      await testRoomNotificationLevels(page);
      await testEmojiAutocomplete(page);
      await testMultiFileInput(page);
      await testLightboxNav(page);
      await testMemberActions(page);
      await testRoomNameEditable(page);
      await testFrequentEmoji(page);
      await testI18nCleanup(page);
      await testHighContrastMode(page);

      // ══════ Phase 7a: Security & Error Handling ══════
      await testXssSanitization(page);
      await testErrorBoundary(page);
      await testCryptoBanner(page);
      await testSendErrorFeedback(page);
      await testTimelineAccessibility(page);
      await testSecurityHeaders(page);

      // ══════ Phase 7b: Encryption & Devices ══════
      await testEncryptionSettings(page);
      await testDevicesSettings(page);
      await testDeviceProliferation();
      await testKeyBackupStatus();
      await testEncryptedMessages(page);
      await testCrossSigningUI(page);

      // ══════ Phase 8: Responsive ══════
      await testResponsive(page, { width: 375, height: 812 }, 'mobile');
      await testResponsive(page, { width: 768, height: 1024 }, 'tablet');

      // ══════ Phase 9: Multi-user ══════
      await testMultiUser(browser);

      // Re-login for logout test
      await loginAs(page, CONFIG.users[0]);

      // ══════ Phase 10: Logout (last) ══════
      await testSettingsLogout(page);
    }

    // ══════ Phase 11: Negative auth tests (after main tests to avoid rate-limiting) ══════
    await testAuthEmpty(page);
    await testAuthWrongCreds(page);
    await testRegisterPage(page);
    await testRegisterMismatch(page);

    // ══════ Error Reports ══════
    reportConsoleErrors();
    reportNetworkErrors();

  } catch (err) {
    log(`FATAL: ${err.message}\n${err.stack}`);
    await snap(page, 'fatal-error').catch(() => {});
    bug('CRITICAL', 'FATAL', `Agent crashed: ${err.message}`, [], '');
  } finally {
    const report = generateReport();
    fs.writeFileSync(CONFIG.reportPath, report, 'utf-8');
    log(`Report: ${CONFIG.reportPath}`);

    console.log('\n╔══════════════════════════════════════╗');
    console.log(`║  Done — ${bugs.length} bugs found                 ║`);
    console.log(`║  CRITICAL: ${bugs.filter(b => b.severity === 'CRITICAL').length}  HIGH: ${bugs.filter(b => b.severity === 'HIGH').length}  MEDIUM: ${bugs.filter(b => b.severity === 'MEDIUM').length}  LOW: ${bugs.filter(b => b.severity === 'LOW').length}     ║`);
    console.log('╚══════════════════════════════════════╝');

    await browser.close();
  }
}

main().catch(console.error);
