import { CONFIG } from './config.js';
import { log } from './helpers.js';
import { api, ensureUser, createRoom, inviteUser, joinRoom, sendMessage, enableEncryption } from './api.js';

/**
 * Purge all stale test rooms (anything with name starting "QA " or "Saved Messages" duplicates).
 * Uses Synapse admin API which requires testuser1 to be admin (set via shared-secret registration).
 * Best-effort: silently skips rooms it can't purge.
 */
export async function cleanupTestRooms(u1, u2) {
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
export async function cleanupAfterRun() {
  log('═══ POST-RUN CLEANUP ═══');
  const u1 = CONFIG.users[0];
  if (!u1?.token) { log('  No token — skipping post-run cleanup'); return; }

  // Re-fetch and purge anything still matching our test patterns
  // (catches dynamically-created rooms like "QA Invite Test", "QA Test Space")
  await cleanupTestRooms(u1, CONFIG.users[1]);
}

/** Full setup: users, rooms, messages */
export async function setup() {
  log('═══ PHASE 0: SETUP ═══');

  const HS = CONFIG.homeserver;

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
      { user: u2, text: 'И последнее тестов��е сообщение.' },
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

  log('═══ SETUP COMPLETE ══��');
  log(`  Users: ${u1.userId}, ${u2.userId}`);
  log(`  Rooms: general=${CONFIG.rooms.general}, dm=${CONFIG.rooms.direct}, empty=${CONFIG.rooms.empty}, media=${CONFIG.rooms.media}`);
  return true;
}
