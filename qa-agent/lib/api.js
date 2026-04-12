import crypto from 'crypto';
import { CONFIG } from './config.js';
import { log } from './helpers.js';

const HS = CONFIG.homeserver;

export async function api(method, path, body, token, _retries = 5) {
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
export async function registerSharedSecret(username, password, admin = false) {
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
export async function registerOpen(username, password) {
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
export async function matrixLogin(username, password) {
  const res = await api('POST', '/_matrix/client/v3/login', {
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: username },
    password,
  });
  return res.ok ? res.data : null;
}

/** Create or ensure a user exists and return access token */
export async function ensureUser(username, password) {
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
export async function enableEncryption(token, roomId) {
  const res = await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`,
    { algorithm: 'm.megolm.v1.aes-sha2' },
    token,
  );
  return res.ok;
}

/** Create a room and return roomId */
export async function createRoom(token, opts) {
  const res = await api('POST', '/_matrix/client/v3/createRoom', opts, token);
  return res.ok ? res.data.room_id : null;
}

/** Invite user to room */
export async function inviteUser(token, roomId, userId) {
  await api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId }, token);
}

/** Join room */
export async function joinRoom(token, roomId) {
  await api('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {}, token);
}

/** Send a text message, return event_id */
export async function sendMessage(token, roomId, body, txnId) {
  const res = await api('PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId || Date.now()}`,
    { msgtype: 'm.text', body },
    token,
  );
  return res.ok ? res.data.event_id : null;
}

/** Send a mention message from user2 to user1 via API */
export async function setupMentionMessage() {
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
