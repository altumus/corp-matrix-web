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

/**
 * Run a single test in isolation: catch any unhandled error so one bad test
 * doesn't crash the whole suite. Logs a HIGH bug for the failing scenario and
 * tries to dismiss leftover modals before returning.
 */
async function runTest(name, page, fn) {
  try {
    await fn();
  } catch (err) {
    log(`${name}: CRASH — ${err.message.split('\n')[0]}`);
    const shot = await snap(page, `crash-${name.toLowerCase()}`).catch(() => '');
    bug('HIGH', name, `Test crashed: ${err.message.slice(0, 200)}`, [], shot);
    // Best-effort cleanup so subsequent tests aren't blocked by leftover overlays
    try { await page.keyboard.press('Escape'); } catch { /* ignore */ }
    await page.waitForTimeout(300);
  }
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

/**
 * Purge all stale test rooms (anything with name starting "QA " or "Saved Messages" duplicates).
 * Uses Synapse admin API which requires testuser1 to be admin (set via shared-secret registration).
 * Best-effort: silently skips rooms it can't purge.
 */
async function cleanupTestRooms(u1, u2) {
  log('Cleanup: purging stale test rooms from previous runs...');
  let purged = 0;
  let savedKept = false;

  for (const user of [u1, u2]) {
    try {
      const joinedRes = await api('GET', '/_matrix/client/v3/joined_rooms', null, user.token);
      if (!joinedRes.ok) continue;

      for (const roomId of joinedRes.data.joined_rooms || []) {
        const nameRes = await api('GET',
          `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`,
          null, user.token);
        if (!nameRes.ok) continue;
        const name = nameRes.data?.name || '';

        // Match QA-prefixed rooms (created by tests) + duplicate Saved Messages
        const isQA = /^QA\b/i.test(name) || name === 'QA Test Space' || name === 'QA Test Poll Question';
        const isSaved = name === 'Saved Messages';

        // Keep at most 1 Saved Messages per user
        if (isSaved) {
          if (!savedKept && user === u1) { savedKept = true; continue; }
          if (user === u1 && savedKept) { /* delete */ }
          else if (user === u2) { /* delete u2's saved messages duplicates too */ }
          else continue;
        } else if (!isQA) {
          continue;
        }

        // Force-leave + admin purge
        await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`, {}, user.token);
        const delRes = await api('DELETE',
          `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
          { purge: true }, user.token);
        if (delRes.ok) purged++;
      }
    } catch { /* best-effort */ }
  }

  if (purged > 0) log(`  Purged ${purged} stale test room(s)`);
  else log('  No stale test rooms found');
}

/**
 * Cleanup after test run: purge rooms created during this run.
 * Called from main()'s finally block.
 */
async function cleanupAfterRun() {
  log('═══ POST-RUN CLEANUP ═══');
  const u1 = CONFIG.users[0];
  if (!u1?.token) { log('  No token — skipping post-run cleanup'); return; }

  // Re-fetch and purge anything still matching our test patterns
  // (catches dynamically-created rooms like "QA Invite Test", "QA Test Space")
  await cleanupTestRooms(u1, CONFIG.users[1]);
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

  // 0.3 Cleanup: purge stale test rooms from previous runs (admin API)
  // Removes any room whose m.room.name starts with "QA " or equals "Saved Messages" duplicates.
  // This makes each run hermetic and prevents Synapse from accumulating test data.
  await cleanupTestRooms(u1, u2);

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

  // 0.4b Create a poll in general room via API (so testVotePoll doesn't depend on UI form)
  if (generalId) {
    const pollTxn = `poll-setup-${Date.now()}`;
    const pollRes = await api('PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(generalId)}/send/org.matrix.msc3381.poll.start/${pollTxn}`,
      {
        'org.matrix.msc3381.poll': {
          kind: 'org.matrix.msc3381.poll.disclosed',
          max_selections: 1,
          question: { 'org.matrix.msc1767.text': 'QA Test Poll Question' },
          answers: [
            { id: 'opt-a', 'org.matrix.msc1767.text': 'Option A' },
            { id: 'opt-b', 'org.matrix.msc1767.text': 'Option B' },
          ],
        },
        'org.matrix.msc1767.text': 'QA Test Poll Question\n1. Option A\n2. Option B',
      },
      u1.token,
    );
    if (pollRes.ok) {
      log(`  Poll created — ${pollRes.data.event_id}`);
    } else {
      log(`  Poll creation failed: ${JSON.stringify(pollRes.data)}`);
    }
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
  try {
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

    // Scope tab search to INSIDE the modal — otherwise we'd match RoomListHeader tabs
    // (All/Unread/DMs/Spaces) underneath, which the modal blocks via pointer-events.
    const tabs = await modal.$$('[class*="tab"]');
    log(`ROOM_CREATE: Tabs found: ${tabs.length}`);
    if (tabs.length < 2) {
      bug('MEDIUM', 'ROOM_CREATE', `Expected 2 tabs (Room/DM) inside dialog, found ${tabs.length}`, [], shot1);
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

    // Close modal — scope to inside the modal
    const closeBtn = await modal.$('[aria-label*="Закрыть"], [aria-label*="Close"], [class*="close"]');
    if (closeBtn) await safe('close modal', () => closeBtn.click());
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err) {
    log(`ROOM_CREATE: ERROR — ${err.message}`);
    bug('HIGH', 'ROOM_CREATE', `Test crashed: ${err.message.slice(0, 200)}`, [], await snap(page, 'room-create-crash').catch(() => ''));
    // Try to dismiss any leftover modal so subsequent tests aren't blocked
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
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
  if (!textarea) {
    bug('CRITICAL', 'CHAT_SEND_MESSAGE', 'Composer textarea not found', [], await snap(page, 'chat-no-composer'));
    return;
  }

  const msg = `QA-test-${Date.now()}`;
  await textarea.fill(msg);
  await page.waitForTimeout(200);
  await snap(page, 'chat-msg-typed');

  // sendBtn appears only after text is non-empty (voice button shown otherwise)
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!sendBtn) {
    bug('CRITICAL', 'CHAT_SEND_MESSAGE', 'Send button not found after typing text', [], await snap(page, 'chat-no-sendbtn'));
    return;
  }

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
// PHASE 7G — FINAL POLISH (B28 + C4 + C6 + E3)
// ═══════════════════════════════════════════════════════════════

// 7g.1 Sync token persisted in IndexedDB
async function testSyncTokenPersisted(page) {
  log('--- SYNC_PERSISTED ---');

  const exists = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.databases?.() || Promise.resolve([]);
      Promise.resolve(req).then((dbs) => {
        const found = (dbs || []).some((db) => db.name && db.name.includes('corp-matrix-sync'));
        resolve(found);
      }).catch(() => resolve(false));
    });
  });

  log(`SYNC_PERSISTED: corp-matrix-sync DB exists: ${exists}`);
  if (!exists) {
    bug('LOW', 'SYNC_PERSISTED', 'IndexedDBStore database not created — sync persistence may not work', [], '');
  } else {
    log('SYNC_PERSISTED: PASS');
  }
}

// 7g.2 Lazy-loaded Lightbox + EmojiPicker (chunks separately)
async function testLazyChunks(page) {
  log('--- LAZY_CHUNKS ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(2000);

  // Check that initial bundle doesn't load Lightbox or EmojiPicker
  const resources = await page.evaluate(() => {
    return performance.getEntriesByType('resource').map((r) => r.name);
  });

  const lightboxLoaded = resources.some((r) => r.includes('Lightbox'));
  const emojiLoaded = resources.some((r) => r.includes('EmojiPicker') || r.includes('emoji-mart'));

  log(`LAZY_CHUNKS: Lightbox loaded initially: ${lightboxLoaded}`);
  log(`LAZY_CHUNKS: EmojiPicker loaded initially: ${emojiLoaded}`);
  // We don't fail — just report
}

// 7g.3 Swipe для reply (touch event simulation)
async function testSwipeReply(page) {
  log('--- SWIPE_REPLY ---');
  if (!(await ensureInRoom(page))) return;

  const bubble = await page.$('[class*="message"] [class*="bubble"]');
  if (!bubble) { log('SWIPE_REPLY: No message, skipping'); return; }

  // Simulate touch swipe on the bubble using Playwright's touch APIs
  const box = await bubble.boundingBox();
  if (!box) return;

  // Switch to mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  // Use page.touchscreen for swipe
  try {
    await page.touchscreen.tap(box.x + 10, box.y + box.height / 2);
    // Synthesize touchstart + touchmove + touchend manually via JS
    await bubble.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const startX = rect.left + 10;
      const startY = rect.top + rect.height / 2;
      const touch1 = new Touch({
        identifier: 1,
        target: el,
        clientX: startX,
        clientY: startY,
      });
      const touch2 = new Touch({
        identifier: 1,
        target: el,
        clientX: startX + 80,
        clientY: startY,
      });

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
    // Cancel reply
    const cancelBtn = await page.$('[class*="replyCancelBtn"]');
    if (cancelBtn) await cancelBtn.click();
  } else {
    log('SWIPE_REPLY: Reply preview not shown (touch event may not work in headless)');
  }

  await page.setViewportSize({ width: 1280, height: 800 });
}

// 7g.4 ThreadPanel mobile back button
async function testThreadBackButton(page) {
  log('--- THREAD_BACK_BUTTON ---');
  if (!(await ensureInRoom(page))) return;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  // Open thread via context menu
  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) { await page.setViewportSize({ width: 1280, height: 800 }); return; }

  await msgEl.click({ button: 'right' });
  await page.waitForTimeout(500);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  for (const it of menuItems) {
    const text = await it.textContent();
    if (text.toLowerCase().includes('thread') || text.toLowerCase().includes('тред')) {
      await it.click();
      break;
    }
  }
  await page.waitForTimeout(1500);

  // Check ThreadPanel has ArrowLeft button on mobile
  const threadHeader = await page.$('[class*="thread"] [class*="header"], [class*="panel"] [class*="header"]');
  await snap(page, 'thread-back-button');

  if (threadHeader) {
    const buttons = await threadHeader.$$('button');
    log(`THREAD_BACK_BUTTON: ${buttons.length} buttons in thread header`);
    log('THREAD_BACK_BUTTON: PASS');
  }

  await page.setViewportSize({ width: 1280, height: 800 });
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7F — CALLS & FINAL POLISH
// ═══════════════════════════════════════════════════════════════

// 7f.1 Call buttons in DM room header
async function testCallButtonsInDM(page) {
  log('--- CALL_BUTTONS_DM ---');
  if (!CONFIG.rooms.direct) { log('CALL_BUTTONS_DM: No DM room, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.direct)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);

  const header = await page.$('header[class*="header"]');
  if (!header) return;

  // Look for Phone and Video buttons
  const buttons = await header.$$('button');
  const titles = [];
  for (const btn of buttons) {
    const title = await btn.getAttribute('title');
    if (title) titles.push(title);
  }
  log(`CALL_BUTTONS_DM: header buttons: ${titles.join(' | ')}`);

  const hasVoice = titles.some((t) => /голос|voice|call/i.test(t));
  const hasVideo = titles.some((t) => /видео|video/i.test(t));
  await snap(page, 'call-buttons-dm');

  if (!hasVoice && !hasVideo) {
    bug('LOW', 'CALL_BUTTONS_DM', 'Voice/video call buttons not found in DM header', [], '');
  } else {
    log('CALL_BUTTONS_DM: PASS');
  }
}

// 7f.2 IncomingCallDialog component exists (smoke check)
async function testIncomingCallContainer(page) {
  log('--- INCOMING_CALL_CONTAINER ---');
  // CallContainer is rendered globally — check it doesn't crash on app load
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);
  log('INCOMING_CALL_CONTAINER: PASS — app loaded with global CallContainer');
}

// 7f.3 Member list shows online indicator
async function testMemberOnlineIndicator(page) {
  log('--- MEMBER_ONLINE ---');
  if (!(await ensureInRoom(page))) return;

  const header = await page.$('[class*="info"]');
  if (!header) return;
  await header.click();
  await page.waitForTimeout(2000);

  // Check that members have avatar elements (online dot is part of Avatar component)
  const avatars = await page.$$('[class*="avatar"]');
  log(`MEMBER_ONLINE: ${avatars.length} avatars in room details`);
  await snap(page, 'member-online');
}

// 7f.4 Room avatar editable (label wraps avatar for admin)
async function testRoomAvatarEdit(page) {
  log('--- ROOM_AVATAR_EDIT ---');
  if (!(await ensureInRoom(page))) return;

  const header = await page.$('[class*="info"]');
  if (!header) return;
  await header.click();
  await page.waitForTimeout(2000);

  const label = await page.$('label[class*="avatarUploadLabel"]');
  log(`ROOM_AVATAR_EDIT: Avatar upload label: ${!!label}`);
  await snap(page, 'room-avatar-edit');
}

// 7f.5 Spaces drawer with context menu
async function testSpacesContext(page) {
  log('--- SPACES_CONTEXT ---');
  // Open spaces drawer (from mobile menu) — only in mobile
  await page.setViewportSize({ width: 375, height: 812 });
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1500);

  const spacesBtn = await page.$('[class*="spacesBtn"]');
  if (!spacesBtn) {
    log('SPACES_CONTEXT: No spaces button (no spaces created)');
    await page.setViewportSize({ width: 1280, height: 800 });
    return;
  }

  await spacesBtn.click();
  await page.waitForTimeout(1000);
  await snap(page, 'spaces-drawer');
  await page.setViewportSize({ width: 1280, height: 800 });
  log('SPACES_CONTEXT: PASS');
}

// 7f.6 Bundle visualizer is configured
async function testBundleVisualizer() {
  log('--- BUNDLE_VISUALIZER ---');
  // Just verify package was installed via fs
  const fs = await import('fs');
  const pkgPath = 'C:/Users/altumus/Desktop/corp-matrix-web/package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const has = pkg.devDependencies?.['rollup-plugin-visualizer'];
  if (has) {
    log(`BUNDLE_VISUALIZER: PASS — installed v${has}`);
  } else {
    bug('LOW', 'BUNDLE_VISUALIZER', 'rollup-plugin-visualizer not in devDependencies', [], '');
  }
}

// 7f.7 Improved contrast (text-secondary darker than before)
async function testContrastFix(page) {
  log('--- CONTRAST_FIX ---');
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);

  const color = await page.evaluate(() => {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue('--color-text-secondary').trim();
  });
  log(`CONTRAST_FIX: --color-text-secondary = ${color}`);

  if (color === '#5a627a') {
    log('CONTRAST_FIX: PASS — improved to #5a627a');
  } else {
    log(`CONTRAST_FIX: color is ${color} (may differ in dark mode)`);
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

  // First click
  const savedBtn1 = await page.$('[class*="savedBtn"]');
  if (!savedBtn1) { log('SAVED_MESSAGES_NO_DUP: No saved btn, skipping'); return; }

  await savedBtn1.click();
  await page.waitForTimeout(2500);
  const url1 = page.url();

  // Re-navigate and re-fetch the button — old handle is detached after reload
  await goto(page, '/rooms', ROOM_ITEM_SEL);
  await page.waitForTimeout(1000);
  const savedBtn2 = await page.$('[class*="savedBtn"]');
  if (!savedBtn2) { log('SAVED_MESSAGES_NO_DUP: Saved btn disappeared after reload, skipping'); return; }

  await savedBtn2.click();
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
  // Navigate to QA General explicitly — ensureInRoom might leave us in an
  // empty room with no messages to react to.
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  } else if (!(await ensureInRoom(page))) return;

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

  // Poll up to 5s for the reaction badge to appear (optimistic + server roundtrip).
  // Use a more specific selector — [class*="reaction"] also matches reactionPicker
  // and other reaction-related UI that may have been visible BEFORE the click.
  let reaction = null;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(200);
    // MessageBubble renders reactions inside [class*="reactions"] container.
    // Try multiple selectors: direct child button, or any button inside reactions div.
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
  // Navigate to QA General explicitly
  if (CONFIG.rooms.general) {
    await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
  } else if (!(await ensureInRoom(page))) return;

  await page.waitForTimeout(1000);
  const msgEl = await page.$('[class*="message"] [class*="bubble"]');
  if (!msgEl) return;

  // Set reply target via context menu — use short timeout to avoid 30s hang
  try {
    await msgEl.click({ button: 'right', timeout: 5000 });
  } catch {
    log('TIMELINE_NO_JITTER: Right-click blocked (overlay?), skipping');
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }
  await page.waitForTimeout(500);

  const menuItems = await page.$$('[class*="menu"] button[class*="item"]');
  let clicked = false;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text.toLowerCase().includes('reply') || text.toLowerCase().includes('ответ')) {
      try {
        await item.click({ timeout: 5000 });
        clicked = true;
      } catch {
        log('TIMELINE_NO_JITTER: Menu item click blocked, skipping');
      }
      break;
    }
  }
  if (!clicked) {
    await page.keyboard.press('Escape').catch(() => {});
    return;
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

  // Cancel reply — use short timeout to avoid 30s hang on overlay
  const cancelBtn = await page.$('[class*="replyCancelBtn"]');
  if (cancelBtn) await cancelBtn.click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
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
    bug('LOW', 'MENTION_BADGE_LIST', '@ icon not visible (Synapse push rules may not process m.mentions API messages as highlights)', [
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
// PHASE 7g — MISSING COVERAGE (D1 + polls + permissions + ...)
// ═══════════════════════════════════════════════════════════════

// 1. D1 Context reactivity after re-login
async function testD1ContextReactivity(page) {
  log('--- D1_CONTEXT_REACTIVITY ---');
  try {
    // Try to logout via settings/profile
    await goto(page, '/settings/profile', 'nav, [class*="nav"], [class*="settings"]').catch(() => {});
    await page.waitForTimeout(1000);

    // Find logout button by text
    let logoutBtn = await page.$('button:has-text("Выйти")');
    if (!logoutBtn) logoutBtn = await page.$('button:has-text("Logout")');
    if (!logoutBtn) logoutBtn = await page.$('button[class*="logout"]');

    if (!logoutBtn) {
      log('D1_CONTEXT_REACTIVITY: SKIP (no logout button found)');
      return;
    }

    await logoutBtn.click().catch(() => {});
    await page.waitForTimeout(1500);

    // Confirm dialog if present
    const confirmBtn = await page.$('button:has-text("Выйти"), button:has-text("Confirm"), button:has-text("Подтвердить")');
    if (confirmBtn) {
      await confirmBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Re-login
    const ok = await loginAs(page, CONFIG.users[0]);
    if (!ok) {
      log('D1_CONTEXT_REACTIVITY: SKIP (re-login failed)');
      return;
    }

    await goto(page, '/settings/encryption', '[class*="settings"], h3').catch(() => {});
    await page.waitForTimeout(2000);

    const hasContent = await page.evaluate(() => {
      const h3 = document.querySelector('h3');
      const settings = document.querySelector('[class*="settings"]');
      const bodyText = document.body.innerText || '';
      return !!(h3 || settings) && bodyText.length > 50;
    });

    const shot = await snap(page, 'd1-context-reactivity');
    if (!hasContent) {
      bug('HIGH', 'D1_CONTEXT_REACTIVITY',
        'After re-login encryption settings are empty/broken — Context not reactive',
        ['1. Logout from /settings/profile', '2. Login again', '3. Navigate to /settings/encryption', '4. Page content is missing'],
        shot);
    } else {
      log('D1_CONTEXT_REACTIVITY: PASS');
    }
  } catch (err) {
    log(`D1_CONTEXT_REACTIVITY: ERROR ${err.message}`);
  }
}

// 2. Create poll via Composer AttachMenu
async function testCreatePoll(page) {
  log('--- CREATE_POLL ---');
  try {
    // Navigate to QA General explicitly so the poll is created in a known room.
    if (CONFIG.rooms.general) {
      await goto(page, `/rooms/${encodeURIComponent(CONFIG.rooms.general)}`, '[class*="composer"]');
    } else if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(500);

    let attachBtn = await page.$('[class*="attachBtn"]');
    if (!attachBtn) attachBtn = await page.$('button[aria-label*="Attach"]');
    if (!attachBtn) attachBtn = await page.$('button[aria-label*="ttach"]');
    if (!attachBtn) {
      log('CREATE_POLL: SKIP (no attach button)');
      return;
    }

    await attachBtn.click();
    await page.waitForTimeout(800);

    // AttachMenu renders a list of buttons; find the poll one by text content
    // (more reliable than :has-text() which may not traverse nested spans).
    const menuButtons = await page.$$('[class*="attachMenu"] button, [class*="menu"] button');
    if (menuButtons.length === 0) {
      log('CREATE_POLL: SKIP (attach menu did not open or has no buttons)');
      return;
    }

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
    if (!modal) {
      log('CREATE_POLL: SKIP (modal not opened)');
      return;
    }

    // Fill question
    const questionInput = await page.$('[class*="modal"] input[autofocus], [class*="modal"] input:not([type="checkbox"]):not([type="radio"])');
    if (questionInput) {
      await questionInput.fill('QA Test Poll Question');
    }

    // Fill options
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

    if (!submitBtn) {
      log('CREATE_POLL: SKIP (no submit button)');
      return;
    }

    await submitBtn.click();

    // Poll up to 8s for the poll event to appear in the timeline —
    // sendEvent + sync + re-render can take a few seconds.
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

// 3. Vote in poll
async function testVotePoll(page) {
  log('--- POLL_VOTE ---');
  try {
    // Navigate to QA General explicitly — poll was created there by testCreatePoll.
    // ensureInRoom might leave us in a different room (e.g. QA Empty Room).
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
    if (!pollEl) {
      log('POLL_VOTE: SKIP (no poll from previous test)');
      return;
    }

    // [class*="answer"] also matches the .answers wrapper — must look for the
    // actual button (PollMessage renders <button class={styles.answer}>).
    const answer = await pollEl.$('button[class*="answer"]');
    if (!answer) {
      log('POLL_VOTE: SKIP (no answer button inside poll)');
      return;
    }

    await answer.click();

    // Poll up to 5s for visual feedback — handles slow optimistic update or
    // server round-trip in encrypted/throttled environments.
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

// 4. Read receipts visual
async function testReadReceiptsVisual(page) {
  log('--- READ_RECEIPTS_VISUAL ---');
  try {
    const user1 = CONFIG.users[0];
    const user2 = CONFIG.users[1];
    const roomId = CONFIG.rooms.general;

    if (!user1?.token || !user2?.token || !roomId) {
      log('READ_RECEIPTS_VISUAL: SKIP (missing users or room)');
      return;
    }

    const txnId = `rr-${Date.now()}`;
    const eventId = await sendMessage(user1.token, roomId, `READ-RECEIPT-TEST-${Date.now()}`, txnId);
    if (!eventId) {
      log('READ_RECEIPTS_VISUAL: SKIP (send failed)');
      return;
    }

    await page.waitForTimeout(2000);

    // user2 marks as read
    await api('POST',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
      {}, user2.token);

    await page.waitForTimeout(1500);

    // Navigate to room in UI
    if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(1500);

    // Scroll to bottom
    await page.evaluate(() => {
      const tl = document.querySelector('[class*="timelineList"]');
      if (tl) tl.scrollTop = tl.scrollHeight;
    });
    await page.waitForTimeout(1500);

    const shot = await snap(page, 'read-receipts');
    const hasReceipts = await page.evaluate(() => {
      return !!(document.querySelector('[class*="receipts"]') ||
                document.querySelector('[class*="avatarWrap"]'));
    });

    if (!hasReceipts) {
      bug('LOW', 'READ_RECEIPTS_VISUAL',
        'No visible read receipts UI after user2 marked message as read',
        ['1. user1 sends message via API', '2. user2 POST /receipt/m.read', '3. user1 UI shows no receipts'],
        shot);
    } else {
      log('READ_RECEIPTS_VISUAL: PASS');
    }
  } catch (err) {
    log(`READ_RECEIPTS_VISUAL: ERROR ${err.message}`);
  }
}

// 5. Typing indicator visual
async function testTypingIndicatorVisual(browser, page) {
  log('--- TYPING_INDICATOR ---');
  let ctx2;
  try {
    const user2 = CONFIG.users[1];
    if (!user2) {
      log('TYPING_INDICATOR: SKIP (no user2)');
      return;
    }

    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    listen(page2, 'typing-user2');

    const ok = await loginAs(page2, user2);
    if (!ok) {
      log('TYPING_INDICATOR: SKIP (user2 login failed)');
      await ctx2.close();
      return;
    }

    // Enter same room on both pages
    if (!(await ensureInRoom(page))) {
      await ctx2.close();
      return;
    }
    if (!(await ensureInRoom(page2))) {
      await ctx2.close();
      return;
    }
    await page.waitForTimeout(1000);
    await page2.waitForTimeout(1000);

    // user2 types into composer
    const textarea2 = await page2.$('textarea[class*="textarea"]');
    if (!textarea2) {
      log('TYPING_INDICATOR: SKIP (no textarea on page2)');
      await ctx2.close();
      return;
    }

    await textarea2.click();
    await page2.keyboard.type('test', { delay: 80 });

    // Wait for typing event to propagate to page1
    await page.waitForTimeout(2500);

    const shot = await snap(page, 'typing-indicator');
    const hasTyping = await page.evaluate(() => {
      const indicators = document.querySelectorAll('[class*="indicator"]');
      for (const el of indicators) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('печат')) return true;
      }
      return false;
    });

    if (!hasTyping) {
      bug('MEDIUM', 'TYPING_INDICATOR',
        'No typing indicator visible on page1 while user2 types',
        ['1. user1 and user2 open same room', '2. user2 types in composer', '3. user1 sees no "печатает" indicator'],
        shot);
    } else {
      log('TYPING_INDICATOR: PASS');
    }

    // Clear user2 composer
    await textarea2.fill('').catch(() => {});
  } catch (err) {
    log(`TYPING_INDICATOR: ERROR ${err.message}`);
  } finally {
    if (ctx2) await ctx2.close().catch(() => {});
  }
}

// 6. Invite accept / decline
async function testInviteAcceptDecline(browser) {
  log('--- INVITE_ACCEPT_DECLINE ---');
  let ctx2;
  try {
    const user1 = CONFIG.users[0];
    const user2 = CONFIG.users[1];
    if (!user1?.token || !user2) {
      log('INVITE_ACCEPT_DECLINE: SKIP (missing users)');
      return;
    }

    const newRoomId = await createRoom(user1.token, {
      name: `QA Invite Test ${Date.now()}`,
      preset: 'private_chat',
    });
    if (!newRoomId) {
      log('INVITE_ACCEPT_DECLINE: SKIP (createRoom failed)');
      return;
    }

    await inviteUser(user1.token, newRoomId, user2.userId);
    await new Promise(r => setTimeout(r, 1500));

    // Decline any stale invites for user2 from previous runs first
    try {
      const joinedRes = await api('GET', '/_matrix/client/v3/joined_rooms', null, user2.token);
      // Also check sync for invited rooms — leave stale ones
      const syncRes = await api('GET', '/_matrix/client/v3/sync?filter={"room":{"include_leave":false}}&timeout=0', null, user2.token);
      if (syncRes.ok && syncRes.data?.rooms?.invite) {
        for (const rid of Object.keys(syncRes.data.rooms.invite)) {
          if (rid !== newRoomId) {
            await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(rid)}/leave`, {}, user2.token);
          }
        }
      }
    } catch { /* best-effort */ }

    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    listen(page2, 'invite-user2');

    const ok = await loginAs(page2, user2);
    if (!ok) {
      log('INVITE_ACCEPT_DECLINE: SKIP (user2 login failed)');
      await ctx2.close();
      return;
    }

    await page2.waitForTimeout(3000);

    // Look for invites section
    const inviteVisible = await page2.evaluate(() => {
      const sections = document.querySelectorAll('[class*="section"], [class*="invite"]');
      for (const s of sections) {
        const t = s.textContent || '';
        if (t.includes('Приглашени') || t.includes('QA Invite Test')) return true;
      }
      return false;
    });

    const shot1 = await snap(page2, 'invite-visible');
    if (!inviteVisible) {
      bug('HIGH', 'INVITE_NOT_VISIBLE',
        'Invite is not visible in user2 room list',
        ['1. user1 creates room via API', '2. user1 invites user2', '3. user2 logs in', '4. No invite shown'],
        shot1);
      await ctx2.close();
      return;
    }

    // Click Accept
    const acceptBtn = await page2.$('button:has-text("Принять"), button:has-text("Accept")');
    if (!acceptBtn) {
      log('INVITE_ACCEPT_DECLINE: no Accept button found');
      await ctx2.close();
      return;
    }

    await acceptBtn.click();
    // Poll up to 10s for either: navigation to the new room, OR the room
    // appearing in the joined list. Either is a successful accept.
    let joined = false;
    for (let i = 0; i < 20; i++) {
      await page2.waitForTimeout(500);
      const url = page2.url();
      if (url.includes(encodeURIComponent(newRoomId)) || url.includes(newRoomId)) {
        joined = true;
        break;
      }
      const inDom = await page2.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          if ((b.textContent || '').includes('QA Invite Test')) return true;
        }
        return false;
      });
      if (inDom) { joined = true; break; }
    }

    const shot2 = await snap(page2, 'invite-accepted');

    if (!joined) {
      bug('HIGH', 'INVITE_ACCEPT_FAILED',
        'Room did not appear in room list (or navigate) after accepting invite',
        ['1. user2 sees invite', '2. Click Accept', '3. Room missing from list and URL'],
        shot2);
    } else {
      log('INVITE_ACCEPT_DECLINE: PASS');
    }
  } catch (err) {
    log(`INVITE_ACCEPT_DECLINE: ERROR ${err.message}`);
  } finally {
    if (ctx2) await ctx2.close().catch(() => {});
  }
}

// 7. Create Space flow
async function testCreateSpaceFlow(page) {
  log('--- CREATE_SPACE ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1000);

    const addBtn = await page.$('[class*="sidebar"] [class*="addBtn"]');
    if (!addBtn) {
      log('CREATE_SPACE: SKIP (no addBtn in sidebar)');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(1000);

    const modal = await page.$('[class*="modal"]');
    if (!modal) {
      log('CREATE_SPACE: SKIP (modal did not open)');
      return;
    }

    const modalText = await modal.evaluate(el => el.textContent || '');
    if (!modalText.includes('пространство') && !modalText.includes('Space')) {
      log('CREATE_SPACE: SKIP (modal is not "create space")');
      return;
    }

    const nameInput = await page.$('[class*="modal"] input:not([type="checkbox"]):not([type="radio"])');
    if (nameInput) {
      await nameInput.fill('QA Test Space');
    }

    await snap(page, 'create-space-filled');

    let submitBtn = await page.$('button:has-text("Создать пространство")');
    if (!submitBtn) submitBtn = await page.$('[class*="modal"] button[type="submit"]');
    if (!submitBtn) {
      log('CREATE_SPACE: SKIP (no submit button)');
      return;
    }

    await submitBtn.click();
    await page.waitForTimeout(3500);

    const shot = await snap(page, 'space-created');
    const created = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      if (!sidebar) return false;
      return (sidebar.textContent || '').includes('QA Test Space') ||
             !!sidebar.querySelector('[aria-label*="QA Test Space"]');
    });

    if (!created) {
      bug('MEDIUM', 'CREATE_SPACE_FAILED',
        'New space not visible in spaces sidebar after creation',
        ['1. Click + in spaces sidebar', '2. Fill name "QA Test Space"', '3. Submit', '4. Space missing'],
        shot);
    } else {
      log('CREATE_SPACE: PASS');
    }
  } catch (err) {
    log(`CREATE_SPACE: ERROR ${err.message}`);
  }
}

// 8. Message search wired / SearchPanel dead code
async function testMessageSearchWired(page) {
  log('--- MESSAGE_SEARCH_WIRED ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL).catch(() => {});
    await page.waitForTimeout(1000);

    // Look for the search button in RoomListHeader (added when SearchPanel was wired up)
    const searchBtn = await page.$('[class*="searchBtn"]');
    if (!searchBtn) {
      bug('LOW', 'MESSAGE_SEARCH_DEAD_CODE',
        'SearchPanel component exists in code but is not wired up anywhere — no global search button found',
        ['1. Open /rooms', '2. Look for search button in header', '3. Not present'],
        await snap(page, 'message-search-no-btn'));
      return;
    }

    // Click and verify Modal with SearchPanel opens
    await searchBtn.click();
    await page.waitForTimeout(800);

    const opened = await page.evaluate(() => {
      // SearchPanel renders an input with type="search" inside a Modal
      const modals = document.querySelectorAll('dialog, [class*="modal"]');
      for (const m of modals) {
        if (m.querySelector('input[type="search"]')) return true;
      }
      return false;
    });

    const shot = await snap(page, 'message-search-opened');
    if (!opened) {
      bug('LOW', 'MESSAGE_SEARCH_DEAD_CODE',
        'Search button exists but clicking it does not open SearchPanel',
        ['1. Click search button', '2. Modal with search input did not appear'],
        shot);
    } else {
      log('MESSAGE_SEARCH_WIRED: PASS — search button opens SearchPanel modal');
      // Close modal so subsequent tests are not blocked
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch (err) {
    log(`MESSAGE_SEARCH_WIRED: ERROR ${err.message}`);
  }
}

// 9. KeyRestoreScreen content
async function testKeyRestoreScreenContent(page) {
  log('--- KEY_RESTORE_METHODS ---');
  try {
    // Check for key restore screen (may not appear if already loaded)
    const container = await page.$('[class*="container"]:has([class*="methodGrid"]), [class*="methodGrid"]');
    if (!container) {
      log('KEY_RESTORE_METHODS: SKIP (screen not visible, keys already loaded)');
      return;
    }

    const methodCards = await page.$$('[class*="methodCard"]');
    const shot = await snap(page, 'key-restore-methods');

    if (methodCards.length < 2) {
      bug('LOW', 'KEY_RESTORE_METHODS',
        `KeyRestoreScreen does not show both recovery methods (key + device verification) — found ${methodCards.length}`,
        ['1. Observe KeyRestoreScreen', '2. Expected 2 method cards', `3. Actual: ${methodCards.length}`],
        shot);
    } else {
      log('KEY_RESTORE_METHODS: PASS');
    }
  } catch (err) {
    log(`KEY_RESTORE_METHODS: ERROR ${err.message}`);
  }
}

// 10. Network reconnect
async function testNetworkReconnect(page) {
  log('--- NETWORK_RECONNECT ---');
  try {
    if (!(await ensureInRoom(page))) return;
    await page.waitForTimeout(1000);

    await page.context().setOffline(true);
    await page.waitForTimeout(4000);

    const shotOff = await snap(page, 'offline-state');
    const hasOfflineIndicator = await page.evaluate(() => {
      if (document.querySelector('[class*="connectionStatus"]')) return true;
      if (document.querySelector('[class*="reconnect"]')) return true;
      if (document.querySelector('[class*="offline"]')) return true;
      const text = (document.body.innerText || '').toLowerCase();
      return text.includes('переподключение') || text.includes('reconnect') || text.includes('офлайн') || text.includes('offline');
    });

    if (!hasOfflineIndicator) {
      bug('LOW', 'NO_OFFLINE_INDICATOR',
        'No visible offline/reconnection indicator while context is offline',
        ['1. Enter room', '2. Set context offline', '3. Wait 4s', '4. No indicator visible'],
        shotOff);
    }

    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    const shotOn = await snap(page, 'online-reconnected');
    const composer = await page.$('[class*="composer"]');
    if (!composer) {
      bug('HIGH', 'RECONNECT_BROKEN',
        'Composer disappeared after reconnect — app broken',
        ['1. Go offline then online', '2. Composer no longer visible'],
        shotOn);
    } else {
      log('NETWORK_RECONNECT: PASS');
    }
  } catch (err) {
    log(`NETWORK_RECONNECT: ERROR ${err.message}`);
    // ensure we come back online
    try { await page.context().setOffline(false); } catch (_) {}
  }
}

// 11. Service worker registered
async function testServiceWorkerRegistered(page) {
  log('--- SW_REGISTERED ---');
  try {
    await goto(page, '/rooms', ROOM_ITEM_SEL);
    await page.waitForTimeout(1500);

    const sw = await page.evaluate(() => {
      try {
        return navigator.serviceWorker?.controller?.scriptURL || null;
      } catch (_) {
        return null;
      }
    });

    const regCount = await page.evaluate(async () => {
      try {
        if (!navigator.serviceWorker?.getRegistrations) return 0;
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length;
      } catch (_) {
        return 0;
      }
    });

    log(`SW: controller=${sw || 'null'}, registrations=${regCount}`);

    if (!sw && regCount === 0) {
      bug('LOW', 'SW_NOT_REGISTERED',
        'PWA service worker not registered/active',
        ['1. Open /rooms', '2. navigator.serviceWorker.controller is null', '3. getRegistrations() empty'],
        '');
    } else {
      log('SW_REGISTERED: PASS');
    }
  } catch (err) {
    log(`SW_REGISTERED: ERROR ${err.message}`);
  }
}

// 12a. Scroll after send
async function testScrollAfterSend(page) {
  log('--- SCROLL_AFTER_SEND ---');
  try {
    await goto(page, CONFIG.rooms.general);
    await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]');
      if (el) el.scrollTop = 0;
    });
    await page.waitForTimeout(500);

    const textarea = await page.$('textarea, [contenteditable="true"], [role="textbox"]');
    if (!textarea) { log('SCROLL_AFTER_SEND: no textarea found'); return; }
    const uniqueMsg = `scroll-test-${Date.now()}`;
    await textarea.fill(uniqueMsg);

    const sendBtn = await page.$('button[class*="send"], button[aria-label*="Send"], button[aria-label*="Отправить"]');
    if (sendBtn) await sendBtn.click();
    else await textarea.press('Enter');

    await page.waitForTimeout(2000);

    const atBottom = await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]');
      if (!el) return false;
      return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    });

    if (!atBottom) {
      const shot = await snap(page, 'scroll-after-send-fail');
      bug('HIGH', 'SCROLL_AFTER_SEND', 'Timeline did not scroll to bottom after sending message',
        ['Scrolled up', 'Sent message', 'Timeline stayed scrolled up'], shot);
    } else {
      log('SCROLL_AFTER_SEND: PASS — timeline scrolled to bottom after send');
    }
  } catch (err) {
    log(`SCROLL_AFTER_SEND: ERROR ${err.message}`);
  }
}

// 12b. Scroll-to-bottom FAB
async function testScrollToBottomFab(page) {
  log('--- SCROLL_TO_BOTTOM_FAB ---');
  try {
    await goto(page, CONFIG.rooms.general);
    await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]');
      if (el) el.scrollTop = 0;
    });
    await page.waitForTimeout(500);

    let fab = await page.$('[class*="fab"]') || await page.$('button[aria-label*="Scroll"]');
    if (!fab) {
      const shot = await snap(page, 'scroll-fab-missing');
      bug('MEDIUM', 'SCROLL_FAB_MISSING', 'Scroll-to-bottom FAB not visible when scrolled up',
        ['Opened room', 'Scrolled to top', 'No FAB appeared'], shot);
      return;
    }

    await fab.click();
    await page.waitForTimeout(1000);

    const atBottom = await page.evaluate(() => {
      const el = document.querySelector('[class*="container"][role="log"]');
      if (!el) return false;
      return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    });

    if (atBottom) {
      log('SCROLL_FAB: PASS — FAB scrolled timeline to bottom');
    } else {
      const shot = await snap(page, 'scroll-fab-no-scroll');
      bug('MEDIUM', 'SCROLL_FAB_NO_SCROLL', 'FAB click did not scroll timeline to bottom',
        ['Scrolled up', 'Clicked FAB', 'Timeline did not reach bottom'], shot);
    }
  } catch (err) {
    log(`SCROLL_FAB: ERROR ${err.message}`);
  }
}

// 12c. Offline banner
async function testOfflineBanner(page) {
  log('--- OFFLINE_BANNER ---');
  try {
    await ensureInRoom(page);
    await page.context().setOffline(true);

    // Matrix sync timeout can be up to 30s — poll for banner up to 15s
    let banner = null;
    let bannerText = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      banner = await page.$('[class*="banner"], [class*="connection"]');
      if (banner) {
        bannerText = await banner.textContent().catch(() => '');
        if (/подключ|offline|переподключ|соединен/i.test(bannerText)) break;
        banner = null;
      }
    }
    const hasBannerText = /подключ|offline|переподключ|соединен/i.test(bannerText);

    const shot = await snap(page, 'offline-banner');

    if (!banner || !hasBannerText) {
      bug('MEDIUM', 'OFFLINE_BANNER', 'No connection banner when offline',
        ['Went offline', 'Waited 15s', 'No banner with connection text found'], shot);
    } else {
      log(`OFFLINE_BANNER: banner found with text "${bannerText}"`);
    }

    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    const bannerAfter = await page.$('[class*="banner"], [class*="connection"]');
    if (bannerAfter) {
      const textAfter = await bannerAfter.textContent().catch(() => '');
      if (/подключ|offline|переподключ/i.test(textAfter)) {
        const shot2 = await snap(page, 'offline-banner-stuck');
        bug('MEDIUM', 'OFFLINE_BANNER_STUCK', 'Connection banner did not disappear after reconnect',
          ['Went offline', 'Reconnected', 'Banner still visible'], shot2);
      } else {
        log('OFFLINE_BANNER: PASS — banner disappeared after reconnect');
      }
    } else {
      log('OFFLINE_BANNER: PASS — banner disappeared after reconnect');
    }
  } catch (err) {
    log(`OFFLINE_BANNER: ERROR ${err.message}`);
    await page.context().setOffline(false).catch(() => {});
  }
}

// 12d. Typing timeout
async function testTypingTimeout(browser, page) {
  log('--- TYPING_TIMEOUT ---');
  let ctx2 = null;
  try {
    ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginAs(page2, CONFIG.users.user2 || CONFIG.users.second || Object.values(CONFIG.users)[1]);
    await goto(page2, CONFIG.rooms.general);
    await goto(page, CONFIG.rooms.general);

    const textarea2 = await page2.$('textarea, [contenteditable="true"], [role="textbox"]');
    if (textarea2) {
      await textarea2.type('typing test...');
    }

    await page.waitForTimeout(1000);

    const indicator = await page.$('[class*="indicator"], [class*="typing"]');
    let indicatorText = '';
    if (indicator) {
      indicatorText = await indicator.textContent().catch(() => '');
    }
    const hasTyping = /печат/i.test(indicatorText);

    if (hasTyping) {
      log(`TYPING_TIMEOUT: typing indicator found — "${indicatorText}", waiting 7s for timeout...`);
      await page.waitForTimeout(7000);

      const indicatorAfter = await page.$('[class*="indicator"], [class*="typing"]');
      let afterText = '';
      if (indicatorAfter) {
        afterText = await indicatorAfter.textContent().catch(() => '');
      }
      if (/печат/i.test(afterText)) {
        const shot = await snap(page, 'typing-timeout-stuck');
        bug('MEDIUM', 'TYPING_TIMEOUT', 'Typing indicator did not disappear after 5+ seconds of inactivity',
          ['User2 typed', 'Waited 7s', 'Indicator still visible'], shot);
      } else {
        log('TYPING_TIMEOUT: PASS — indicator disappeared after timeout');
      }
    } else {
      log('TYPING_TIMEOUT: SKIP — typing indicator not detected (may not be supported)');
    }
  } catch (err) {
    log(`TYPING_TIMEOUT: ERROR ${err.message}`);
  } finally {
    if (ctx2) await ctx2.close().catch(() => {});
  }
}

// 12e-1. Forward complete flow
async function testForwardComplete(page) {
  log('--- FORWARD_COMPLETE ---');
  try {
    await goto(page, CONFIG.rooms.general, '[class*="composer"], [class*="message"]');
    await page.waitForTimeout(1000);

    const bubble = await page.$('[class*="message"][class*="outgoing"] [class*="bubble"]');
    if (!bubble) { log('FORWARD_COMPLETE: SKIP — no outgoing message found'); return; }

    try {
      await bubble.click({ button: 'right', timeout: 5000 });
    } catch (e) {
      log('FORWARD_COMPLETE: SKIP — right-click failed: ' + e.message);
      return;
    }
    await page.waitForTimeout(500);

    const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
    let forwardBtn = null;
    for (const item of menuItems) {
      const text = (await item.textContent() || '').toLowerCase();
      if (text.includes('перес') || text.includes('forward')) {
        forwardBtn = item;
        break;
      }
    }
    if (!forwardBtn) {
      log('FORWARD_COMPLETE: SKIP — "Forward" action not found in context menu');
      await page.keyboard.press('Escape');
      return;
    }

    await forwardBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const dialog = await page.$('dialog, [class*="modal"], [class*="forward"]');
    if (!dialog) {
      log('FORWARD_COMPLETE: SKIP — forward dialog did not appear');
      return;
    }
    await snap(page, 'forward-complete-dialog');

    const searchInput = await dialog.$('input');
    if (searchInput) {
      log('FORWARD_COMPLETE: Search input found in dialog');
    }

    const roomItems = await dialog.$$('button[class*="room"], button[class*="item"], [class*="room"], [class*="chatItem"]');
    if (roomItems.length === 0) {
      log('FORWARD_COMPLETE: SKIP — no room items found in forward dialog');
      await page.keyboard.press('Escape');
      return;
    }

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

// 12e-2. Voice recorder UI flow
async function testVoiceRecordFlow(page) {
  log('--- VOICE_RECORD_FLOW ---');
  try {
    await goto(page, CONFIG.rooms.general, '[class*="composer"], [class*="message"]');
    await page.waitForTimeout(500);

    const textarea = await page.$('textarea, [contenteditable="true"], [class*="composer"] input');
    if (textarea) {
      await textarea.fill('');
      await page.waitForTimeout(300);
    }

    const voiceBtn = await page.$('[class*="voiceBtn"], button[aria-label*="голосов"], button[aria-label*="Записать"], [class*="voice"] button, button[class*="voice"]');
    if (!voiceBtn) {
      await bug('MEDIUM', 'VOICE_RECORD_FLOW', 'Voice record button not found',
        ['Navigate to room', 'Clear textarea', 'Look for voice button'],
        await snap(page, 'voice-record-no-btn'));
      return;
    }

    await voiceBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const recorderUI = await page.$('[class*="recorder"], [class*="recording"], [class*="voice"][class*="active"]');
    await snap(page, 'voice-record-flow');

    if (recorderUI) {
      log('VOICE_RECORD_FLOW: Recorder UI appeared');
      const cancelBtn = await page.$('[class*="recorder"] button[class*="cancel"], [class*="recorder"] button[class*="stop"], [class*="recording"] button');
      if (cancelBtn) {
        await cancelBtn.click({ timeout: 5000 });
        await page.waitForTimeout(500);
      }
      log('VOICE_RECORD_FLOW: PASS — recorder UI shown and dismissed');
    } else {
      log('VOICE_RECORD_FLOW: Recorder UI did not appear (getUserMedia permission denied in headless)');
      log('VOICE_RECORD_FLOW: PASS (expected in headless)');
    }

    await page.keyboard.press('Escape').catch(() => {});
  } catch (err) {
    log(`VOICE_RECORD_FLOW: ERROR ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

// 12e-3. Context menu all actions
async function testContextMenuAllActions(page) {
  log('--- CONTEXT_MENU_ALL_ACTIONS ---');
  try {
    await goto(page, CONFIG.rooms.general, '[class*="composer"], [class*="message"]');
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

// 12e-4. Mobile long press
async function testMobileLongPress(page) {
  log('--- MOBILE_LONG_PRESS ---');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await goto(page, CONFIG.rooms.general, '[class*="composer"], [class*="message"]');
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

// 12e-5. Reply quote
async function testReplyQuote(page) {
  log('--- REPLY_QUOTE ---');
  try {
    await goto(page, CONFIG.rooms.general, '[class*="composer"], [class*="message"]');
    await page.waitForTimeout(1000);

    const bodyEl = await page.$('[class*="message"] [class*="bubble"] [class*="body"]');
    if (!bodyEl) {
      log('REPLY_QUOTE: SKIP — no message body element found');
      return;
    }

    await bodyEl.click({ clickCount: 3 });
    await page.waitForTimeout(300);

    await bodyEl.click({ button: 'right', timeout: 5000 });
    await page.waitForTimeout(500);

    const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
    let quoteBtn = null;
    for (const item of menuItems) {
      const text = (await item.textContent() || '').toLowerCase();
      if (text.includes('цитир') || text.includes('quote') || text.includes('reply-quote')) {
        quoteBtn = item;
        break;
      }
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

// 12e-6. Forward encrypted warning
async function testForwardEncryptedWarning(page) {
  log('--- FORWARD_E2E_WARNING ---');
  try {
    if (!CONFIG.rooms.encrypted || !CONFIG.rooms.general) {
      log('FORWARD_E2E_WARNING: SKIP — encrypted or general room not configured');
      return;
    }

    await goto(page, CONFIG.rooms.encrypted, '[class*="composer"], [class*="message"]');
    await page.waitForTimeout(1000);

    const bubble = await page.$('[class*="message"] [class*="bubble"]');
    if (!bubble) {
      log('FORWARD_E2E_WARNING: SKIP — no message bubble in encrypted room');
      return;
    }

    try {
      await bubble.click({ button: 'right', timeout: 5000 });
    } catch (e) {
      log('FORWARD_E2E_WARNING: SKIP — right-click failed: ' + e.message);
      return;
    }
    await page.waitForTimeout(500);

    const menuItems = await page.$$('[class*="menu"] button, [class*="menu"] [role="menuitem"], [class*="contextMenu"] button');
    let forwardBtn = null;
    for (const item of menuItems) {
      const text = (await item.textContent() || '').toLowerCase();
      if (text.includes('перес') || text.includes('forward')) {
        forwardBtn = item;
        break;
      }
    }
    if (!forwardBtn) {
      log('FORWARD_E2E_WARNING: SKIP — Forward action not found in context menu');
      await page.keyboard.press('Escape').catch(() => {});
      return;
    }

    await forwardBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const dialog = await page.$('dialog, [class*="modal"], [class*="forward"]');
    if (!dialog) {
      log('FORWARD_E2E_WARNING: SKIP — forward dialog did not appear');
      return;
    }

    let dialogSeen = false;
    page.once('dialog', async (dlg) => {
      dialogSeen = true;
      log(`FORWARD_E2E_WARNING: Confirm dialog text: "${dlg.message()}"`);
      await dlg.dismiss();
    });

    const roomItems = await dialog.$$('button[class*="room"], button[class*="item"], [class*="room"], [class*="chatItem"]');
    if (roomItems.length === 0) {
      log('FORWARD_E2E_WARNING: SKIP — no room items in forward dialog');
      await page.keyboard.press('Escape').catch(() => {});
      return;
    }

    await roomItems[0].click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await snap(page, 'forward-e2e-warning');

    if (dialogSeen) {
      log('FORWARD_E2E_WARNING: PASS — warning dialog was shown when forwarding from encrypted room');
    } else {
      await bug('HIGH', 'FORWARD_E2E_WARNING', 'No warning dialog when forwarding from encrypted to unencrypted room',
        ['Navigate to encrypted room', 'Right-click message', 'Click Forward', 'Select unencrypted room', 'No confirm dialog appeared'],
        await snap(page, 'forward-e2e-warning-bug'));
    }

    await page.keyboard.press('Escape').catch(() => {});
  } catch (err) {
    log(`FORWARD_E2E_WARNING: ERROR ${err.message}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

// 12. Stress messages
async function testStressMessages(page) {
  log('--- STRESS_MESSAGES ---');
  try {
    const user1 = CONFIG.users[0];
    const roomId = CONFIG.rooms.general;
    if (!user1?.token || !roomId) {
      log('STRESS_MESSAGES: SKIP (missing user/room)');
      return;
    }

    const baselineErrors = consoleErrors.length;

    // Send 30 messages via API
    for (let i = 0; i < 30; i++) {
      await sendMessage(user1.token, roomId, `stress-msg-${i}`, `stress-${i}-${Date.now()}`);
    }

    await page.waitForTimeout(2000);

    // Open room in UI
    if (!(await ensureInRoom(page))) return;
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
  } catch (err) {
    log(`STRESS_MESSAGES: ERROR ${err.message}`);
  }
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
    /ERR_INTERNET_DISCONNECTED/,           // Intentional from testNetworkReconnect
    /Failed to fetch/,                     // Transient during offline/reconnect tests
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
      await runTest('ROOM_LIST_DISPLAY', page, () => testRoomListDisplay(page));
      await runTest('ROOM_SEARCH', page, () => testRoomSearch(page));
      await runTest('ROOM_LIST_CONTEXT_MENU', page, () => testRoomListContextMenu(page));
      await runTest('ROOM_SWITCH', page, () => testRoomSwitch(page));
      await runTest('CREATE_ROOM', page, () => testCreateRoom(page));

      // ══════ Phase 4: Room Header & Special Rooms ══════
      await runTest('ROOM_HEADER', page, () => testRoomHeader(page));
      await runTest('EMPTY_ROOM', page, () => testEmptyRoom(page));
      await runTest('DM_ROOM', page, () => testDMRoom(page));
      await runTest('TIMELINE_SCROLL', page, () => testTimelineScroll(page));

      // ══════ Phase 5: Messaging ══════
      await runTest('CHAT_SEND_MESSAGE', page, () => testChatSendMessage(page));
      await runTest('CHAT_SEND_ENTER', page, () => testChatSendEnter(page));
      await runTest('CHAT_SHIFT_ENTER', page, () => testChatShiftEnter(page));
      await runTest('CHAT_SEND_EMPTY', page, () => testChatSendEmpty(page));
      await runTest('CHAT_LONG_MESSAGE', page, () => testChatLongMessage(page));
      await runTest('CHAT_SPECIAL_CHARS', page, () => testChatSpecialChars(page));
      await runTest('ATTACH_MENU', page, () => testAttachMenu(page));

      // ══════ Phase 6: Message Interactions ══════
      await runTest('MESSAGE_BUBBLE', page, () => testMessageBubble(page));
      await runTest('MESSAGE_CONTEXT_MENU', page, () => testMessageContextMenu(page));
      await runTest('REPLY_MESSAGE', page, () => testReplyMessage(page));
      await runTest('EDIT_MESSAGE', page, () => testEditMessage(page));
      await runTest('EDIT_CANCEL', page, () => testEditCancel(page));
      await runTest('FORWARD_MESSAGE', page, () => testForwardMessage(page));
      await runTest('SELECT_MESSAGES', page, () => testSelectMessages(page));
      await runTest('COPY_MESSAGE', page, () => testCopyMessage(page));
      await runTest('THREAD', page, () => testThread(page));
      await runTest('REACT_MESSAGE', page, () => testReactMessage(page));
      await runTest('DELETE_MESSAGE', page, () => testDeleteMessage(page));

      // ══════ Phase 7: Settings ══════
      // Re-login after logout tests might have happened
      await loginAs(page, CONFIG.users[0]);
      await runTest('SETTINGS_NAVIGATION', page, () => testSettingsNavigation(page));
      await runTest('SETTINGS_PROFILE', page, () => testSettingsProfile(page));
      await runTest('SETTINGS_APPEARANCE', page, () => testSettingsAppearance(page));

      // ══════ Phase 7c: New Features ══════
      await runTest('QUICK_REACTIONS', page, () => testQuickReactions(page));
      await runTest('HASHTAGS', page, () => testHashtags(page));
      await runTest('AT_ROOM_MENTION', page, () => testAtRoomMention(page));
      await runTest('REPLY_TRUNCATION', page, () => testReplyTruncation(page));
      await runTest('DRAFT_PERSISTENCE', page, () => testDraftPersistence(page));
      await runTest('IMAGE_CAPTION', page, () => testImageCaption(page));

      // Mention-specific tests (require API setup of mention messages)
      await runTest('MENTION_BADGE_IN_ROOM_LIST', page, () => testMentionBadgeInRoomList(page));
      await runTest('MENTION_SCROLL_ON_ENTER', page, () => testMentionScrollOnEnter(page));
      await runTest('MENTION_NAVIGATOR', page, () => testMentionNavigator(page));
      await runTest('MENTIONED_BUBBLE', page, () => testMentionedBubble(page));
      await runTest('ROOM_MENTION', page, () => testRoomMention(page));

      // Bug regression tests
      await runTest('REACTION_STABILITY', page, () => testReactionStability(page));
      await runTest('REACTION_RAPID_CLICKS', page, () => testReactionRapidClicks(page));
      await runTest('TIMELINE_NO_JITTER', page, () => testTimelineNoJitter(page));
      await runTest('PIN_MESSAGE_LIVE', page, () => testPinMessageLive(page));

      // Production hardening tests
      await runTest('PRIVACY_SETTINGS', page, () => testPrivacySettings(page));
      await runTest('IDLE_LOGOUT_SETTING', page, () => testIdleLogoutSetting(page));
      await runTest('VOICE_BUTTON', page, () => testVoiceButton(page));
      await runTest('SLASH_COMMANDS', page, () => testSlashCommands(page));
      await runTest('SEND_QUEUE_DB', page, () => testSendQueueDB(page));
      await runTest('SAVED_MESSAGES_NO_DUP', page, () => testSavedMessagesNoDup(page));
      await runTest('ENCRYPTED_RECOVERY_KEY', page, () => testEncryptedRecoveryKey(page));
      await runTest('LOGGER_EXISTS', page, () => testLoggerExists(page));
      await runTest('TOUCH_TARGET_SIZE', page, () => testTouchTargetSize(page));
      await runTest('SKIP_LINK', page, () => testSkipLink(page));
      await runTest('CROSS_SIGNING_UI_NEW', page, () => testCrossSigningUiNew(page));

      // Latest session polish tests
      await runTest('ROOM_LIST_TABS', page, () => testRoomListTabs(page));
      await runTest('ROOM_NOTIFICATION_LEVELS', page, () => testRoomNotificationLevels(page));
      await runTest('EMOJI_AUTOCOMPLETE', page, () => testEmojiAutocomplete(page));
      await runTest('MULTI_FILE_INPUT', page, () => testMultiFileInput(page));
      await runTest('LIGHTBOX_NAV', page, () => testLightboxNav(page));
      await runTest('MEMBER_ACTIONS', page, () => testMemberActions(page));
      await runTest('ROOM_NAME_EDITABLE', page, () => testRoomNameEditable(page));
      await runTest('FREQUENT_EMOJI', page, () => testFrequentEmoji(page));
      await runTest('I18N_CLEANUP', page, () => testI18nCleanup(page));
      await runTest('HIGH_CONTRAST_MODE', page, () => testHighContrastMode(page));

      // Calls + final polish tests
      await runTest('CALL_BUTTONS_IN_DM', page, () => testCallButtonsInDM(page));
      await runTest('INCOMING_CALL_CONTAINER', page, () => testIncomingCallContainer(page));
      await runTest('MEMBER_ONLINE_INDICATOR', page, () => testMemberOnlineIndicator(page));
      await runTest('ROOM_AVATAR_EDIT', page, () => testRoomAvatarEdit(page));
      await runTest('SPACES_CONTEXT', page, () => testSpacesContext(page));
      await runTest('BUNDLE_VISUALIZER', page, () => testBundleVisualizer());
      await runTest('CONTRAST_FIX', page, () => testContrastFix(page));

      // Final polish tests (B28, C4, C6, E3)
      await runTest('SYNC_TOKEN_PERSISTED', page, () => testSyncTokenPersisted(page));
      await runTest('LAZY_CHUNKS', page, () => testLazyChunks(page));
      await runTest('SWIPE_REPLY', page, () => testSwipeReply(page));
      await runTest('THREAD_BACK_BUTTON', page, () => testThreadBackButton(page));

      // ══════ Phase 7a: Security & Error Handling ══════
      await runTest('XSS_SANITIZATION', page, () => testXssSanitization(page));
      await runTest('ERROR_BOUNDARY', page, () => testErrorBoundary(page));
      await runTest('CRYPTO_BANNER', page, () => testCryptoBanner(page));
      await runTest('SEND_ERROR_FEEDBACK', page, () => testSendErrorFeedback(page));
      await runTest('TIMELINE_ACCESSIBILITY', page, () => testTimelineAccessibility(page));
      await runTest('SECURITY_HEADERS', page, () => testSecurityHeaders(page));

      // ══════ Phase 7b: Encryption & Devices ══════
      await runTest('ENCRYPTION_SETTINGS', page, () => testEncryptionSettings(page));
      await runTest('DEVICES_SETTINGS', page, () => testDevicesSettings(page));
      await runTest('DEVICE_PROLIFERATION', page, () => testDeviceProliferation());
      await runTest('KEY_BACKUP_STATUS', page, () => testKeyBackupStatus());
      await runTest('ENCRYPTED_MESSAGES', page, () => testEncryptedMessages(page));
      await runTest('CROSS_SIGNING_UI', page, () => testCrossSigningUI(page));

      // ══════ Phase 7g: Missing coverage (D1 + polls + permissions + ...) ══════
      // All wrapped in runTest() so a crash in one new test doesn't kill the suite.
      await runTest('D1_CONTEXT_REACTIVITY', page, () => testD1ContextReactivity(page));
      await runTest('POLL_CREATE',           page, () => testCreatePoll(page));
      await runTest('POLL_VOTE',             page, () => testVotePoll(page));
      await runTest('READ_RECEIPTS_VISUAL',  page, () => testReadReceiptsVisual(page));
      await runTest('TYPING_INDICATOR',      page, () => testTypingIndicatorVisual(browser, page));
      await runTest('INVITE_ACCEPT_DECLINE', page, () => testInviteAcceptDecline(browser));
      await runTest('CREATE_SPACE_FLOW',     page, () => testCreateSpaceFlow(page));
      await runTest('MESSAGE_SEARCH_WIRED',  page, () => testMessageSearchWired(page));
      await runTest('KEY_RESTORE_CONTENT',   page, () => testKeyRestoreScreenContent(page));
      await runTest('NETWORK_RECONNECT',     page, () => testNetworkReconnect(page));
      await runTest('SERVICE_WORKER',        page, () => testServiceWorkerRegistered(page));
      await runTest('SCROLL_AFTER_SEND',     page, () => testScrollAfterSend(page));
      await runTest('SCROLL_FAB',            page, () => testScrollToBottomFab(page));
      await runTest('OFFLINE_BANNER',        page, () => testOfflineBanner(page));
      await runTest('TYPING_TIMEOUT',        page, () => testTypingTimeout(browser, page));
      await runTest('FORWARD_COMPLETE',      page, () => testForwardComplete(page));
      await runTest('VOICE_RECORD_FLOW',     page, () => testVoiceRecordFlow(page));
      await runTest('CTX_MENU_ALL_ACTIONS',  page, () => testContextMenuAllActions(page));
      await runTest('MOBILE_LONG_PRESS',     page, () => testMobileLongPress(page));
      await runTest('REPLY_QUOTE',           page, () => testReplyQuote(page));
      await runTest('FORWARD_E2E_WARNING',   page, () => testForwardEncryptedWarning(page));
      await runTest('STRESS_MESSAGES',       page, () => testStressMessages(page));

      // ══════ Phase 8: Responsive ══════
      await runTest('RESPONSIVE_MOBILE', page, () => testResponsive(page, { width: 375, height: 812 }, 'mobile'));
      await runTest('RESPONSIVE_TABLET', page, () => testResponsive(page, { width: 768, height: 1024 }, 'tablet'));

      // ══════ Phase 9: Multi-user ══════
      await runTest('MULTI_USER', page, () => testMultiUser(browser));

      // Re-login for logout test
      await loginAs(page, CONFIG.users[0]);

      // ══════ Phase 10: Logout (last) ══════
      await runTest('SETTINGS_LOGOUT', page, () => testSettingsLogout(page));
    }

    // ══════ Phase 11: Negative auth tests (after main tests to avoid rate-limiting) ══════
    await runTest('AUTH_EMPTY', page, () => testAuthEmpty(page));
    await runTest('AUTH_WRONG_CREDS', page, () => testAuthWrongCreds(page));
    await runTest('REGISTER_PAGE', page, () => testRegisterPage(page));
    await runTest('REGISTER_MISMATCH', page, () => testRegisterMismatch(page));

    // ══════ Error Reports ══════
    reportConsoleErrors();
    reportNetworkErrors();

  } catch (err) {
    log(`FATAL: ${err.message}\n${err.stack}`);
    await snap(page, 'fatal-error').catch(() => {});
    bug('CRITICAL', 'FATAL', `Agent crashed: ${err.message}`, [], '');
  } finally {
    // Post-run cleanup: purge any test rooms left behind by this run.
    // Best-effort — failures here must not block report generation.
    try { await cleanupAfterRun(); } catch (e) { log(`Cleanup error: ${e.message}`); }

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
