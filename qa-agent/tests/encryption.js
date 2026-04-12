import { CONFIG } from '../lib/config.js';
import { log, snap, bug, goto } from '../lib/helpers.js';
import { api } from '../lib/api.js';

export async function testEncryptionSettings(page) {
  log('--- ENCRYPTION_SETTINGS ---');
  await goto(page, '/settings/encryption', '[class*="section"], [class*="heading"]');
  const shot = await snap(page, 'encryption-settings');

  const backupBtn = await page.$('button:has-text("backup"), button:has-text("Backup"), button:has-text("резерв"), button:has-text("бэкап")');
  log(`ENCRYPTION_SETTINGS: Key backup button: ${!!backupBtn}`);

  const content = await page.evaluate(() => document.body.innerText);
  const hasBackupInfo = /backup|key|ключ|резерв/i.test(content);
  log(`ENCRYPTION_SETTINGS: Has backup-related content: ${hasBackupInfo}`);

  if (!hasBackupInfo) bug('MEDIUM', 'ENCRYPTION_SETTINGS', 'No key backup info on encryption settings page', [], shot);
}

export async function testDevicesSettings(page) {
  log('--- DEVICES_SETTINGS ---');
  await goto(page, '/settings/devices', '[class*="section"], [class*="device"], [class*="heading"]');
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'devices-settings');

  const devices = await page.$$('[class*="device"], [class*="session"]');
  log(`DEVICES_SETTINGS: Device elements: ${devices.length}`);

  const pageText = await page.evaluate(() => document.body.innerText);
  const hasCurrentDevice = /current|текущ|this device/i.test(pageText);
  log(`DEVICES_SETTINGS: Current device indicator: ${hasCurrentDevice}`);

  const deviceIds = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="deviceId"], [class*="id"], code, small');
    return Array.from(els).map(e => e.textContent?.trim()).filter(t => t && t.length > 5).slice(0, 5);
  });
  log(`DEVICES_SETTINGS: Device IDs found: ${deviceIds.length}`);
}

export async function testDeviceProliferation() {
  log('--- DEVICE_PROLIFERATION ---');
  const user = CONFIG.users[0];
  if (!user.token) { log('DEVICE_PROLIFERATION: No token, skipping'); return; }

  const res = await api('GET', '/_matrix/client/v3/devices', null, user.token);
  if (!res.ok) { log(`DEVICE_PROLIFERATION: Cannot get devices: ${res.status}`); return; }

  const devices = res.data.devices || [];
  log(`DEVICE_PROLIFERATION: Total devices for ${user.userId}: ${devices.length}`);

  for (const d of devices) {
    const lastSeen = d.last_seen_ts ? new Date(d.last_seen_ts).toISOString().slice(0, 19) : 'never';
    log(`  Device: ${d.device_id} | name="${d.display_name || '-'}" | last_seen=${lastSeen}`);
  }

  if (devices.length > 5) {
    bug('MEDIUM', 'DEVICE_PROLIFERATION', `User has ${devices.length} devices — likely leaking sessions on each login. Old devices should be cleaned up.`, [
      `1. User ${user.userId}`, `2. Has ${devices.length} devices`, '3. Expected: <=3 devices for a test user',
    ], '');
  }

  if (devices.length > 10) {
    bug('HIGH', 'DEVICE_PROLIFERATION', `User has ${devices.length} devices — severe session leak. Each login/test run creates new devices without removing old ones.`, [], '');
  }
}

export async function testKeyBackupStatus() {
  log('--- KEY_BACKUP_STATUS ---');
  const user = CONFIG.users[0];
  if (!user.token) { log('KEY_BACKUP_STATUS: No token, skipping'); return; }

  const res = await api('GET', '/_matrix/client/v3/room_keys/version', null, user.token);

  if (res.status === 404) {
    bug('MEDIUM', 'KEY_BACKUP_STATUS', 'No key backup configured — messages will be lost if user logs out or switches device', [
      '1. Check /room_keys/version', '2. Returns 404 — no backup', '3. E2E messages not recoverable without device keys',
    ], '');
    log('KEY_BACKUP_STATUS: No backup configured (404)');
  } else if (res.ok) {
    log(`KEY_BACKUP_STATUS: Backup exists — version=${res.data.version}, algorithm=${res.data.algorithm}`);
  } else {
    log(`KEY_BACKUP_STATUS: Unexpected response: ${res.status}`);
  }
}

export async function testEncryptedMessages(page) {
  log('--- ENCRYPTED_MESSAGES ---');

  const targetRoom = CONFIG.rooms.encrypted || CONFIG.rooms.general;
  if (!targetRoom) { log('ENCRYPTED_MESSAGES: No room available, skipping'); return; }

  await goto(page, `/rooms/${encodeURIComponent(targetRoom)}`, '[class*="composer"]');
  await page.waitForTimeout(2000);
  const shot = await snap(page, 'encrypted-messages');

  const utdIndicators = await page.evaluate(() => {
    const body = document.body.innerText;
    const indicators = [];
    if (/unable to decrypt|не удалось расшифровать|undecryptable/i.test(body)) indicators.push('UTD text found');
    const bubbles = document.querySelectorAll('[class*="bubble"] [class*="textContent"], [class*="bubble"] p');
    for (const b of bubbles) {
      const t = b.textContent || '';
      if (/encrypted message|🔒/i.test(t) && t.length < 100) indicators.push('encrypted placeholder in bubble');
    }
    const errorIcons = document.querySelectorAll('[class*="error"], [class*="warning"], [class*="shield"]');
    if (errorIcons.length > 0) indicators.push(`${errorIcons.length} error/warning icons`);
    return indicators;
  });

  if (utdIndicators.length > 0) {
    bug('HIGH', 'ENCRYPTED_MESSAGES', `Undecryptable messages found: ${utdIndicators.join(', ')}`, [
      '1. Open encrypted room', '2. Messages cannot be decrypted', '3. Likely caused by missing key backup or device key mismatch',
    ], shot);
  } else {
    log('ENCRYPTED_MESSAGES: No UTD indicators found');
  }

  const encBadge = await page.$('[class*="encryption"], [class*="shield"], [class*="lock"]');
  log(`ENCRYPTED_MESSAGES: Encryption badge in header: ${!!encBadge}`);
}

export async function testCrossSigningUI(page) {
  log('--- CROSS_SIGNING_UI ---');
  await goto(page, '/settings/encryption', '[class*="section"], [class*="heading"]');
  await page.waitForTimeout(1500);
  const shot = await snap(page, 'cross-signing-ui');

  const verifyBtn = await page.$('button:has-text("verify"), button:has-text("верифи"), button:has-text("подтверд")');
  log(`CROSS_SIGNING_UI: Verify button: ${!!verifyBtn}`);

  const pageText = await page.evaluate(() => document.body.innerText);
  const hasCrossSigning = /cross.signing|кросс.подпис|перекрёстн/i.test(pageText);
  const hasVerification = /verif|верифик|подтвержд/i.test(pageText);
  log(`CROSS_SIGNING_UI: Cross-signing info: ${hasCrossSigning}, Verification info: ${hasVerification}`);
}

export async function testCrossSigningUiNew(page) {
  log('--- CROSS_SIGNING_UI_PRESENT ---');
  await goto(page, '/settings/encryption', 'button, h3');
  await page.waitForTimeout(2000);

  const verifyBtn = await page.$('button:has-text("ерифицировать"), button:has-text("Verify")');
  log(`CROSS_SIGNING_UI_PRESENT: Verify button: ${!!verifyBtn}`);

  if (!verifyBtn) {
    bug('LOW', 'CROSS_SIGNING_UI_PRESENT', 'Cross-signing verify button not in encryption settings', [], '');
  }
}

export async function testEncryptedRecoveryKey(page) {
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
            const isEncrypted = val != null && !Array.isArray(val) && typeof val === 'object' && 'iv' in val && 'data' in val;
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

export async function testCryptoBanner(page) {
  log('--- CRYPTO_BANNER ---');
  await goto(page, '/rooms', 'button');

  const banner = await page.$('[class*="CryptoBanner"], [class*="cryptoBanner"]');
  if (banner) {
    const text = await banner.textContent();
    bug('HIGH', 'CRYPTO_BANNER', `Crypto warning banner visible: "${text.trim()}"`, [
      '1. Open app', '2. Yellow banner about encryption appears', '3. E2E may not be working',
    ], await snap(page, 'crypto-banner-visible'));
  } else {
    log('CRYPTO_BANNER: PASS — no warning banner (crypto is working)');
  }
}
