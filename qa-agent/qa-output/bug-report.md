# Bug Report — Corp Matrix Web

**Date:** 2026-04-12
**App URL:** http://localhost:5173
**Homeserver:** http://127.0.0.1:8008
**Total bugs:** 3

## Summary
| Severity | Count |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 0 |
| 🟢 LOW | 3 |

## Bugs
| # | Severity | Scenario | Description | Steps | Screenshot |
|---|---|---|---|---|---|
| 1 | 🟢 LOW | MENTION_BADGE_LIST | @ icon not visible (Synapse push rules may not process m.mentions API messages as highlights) | 1. Send mention to user from another account 2. Open room list 3. @ icon should appear next to the room | [screenshot](screenshots/048-mention-badge-list.png) |
| 2 | 🟢 LOW | ROOM_MENTION | @room mention did not trigger highlight badge |  | - |
| 3 | 🟢 LOW | NO_OFFLINE_INDICATOR | No visible offline/reconnection indicator while context is offline | 1. Enter room 2. Set context offline 3. Wait 4s 4. No indicator visible | [screenshot](screenshots/080-offline-state.png) |

## Console Errors
- `2026-04-12T21:48:05.211Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:07.437Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:07.480Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:07.667Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:11.066Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:11.452Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:11.464Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:12.925Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:19.705Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:20.052Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:20.064Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:22.326Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:22.651Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:22.674Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:24.083Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:24.399Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:24.422Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:37.857Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:38.205Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:38.244Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:39.696Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:40.013Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:40.022Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T21:48:43.753Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T21:48:44.073Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)

## Network Errors
- `2026-04-12T21:48:05.211Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T21:48:07.437Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T21:48:07.480Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T21:48:07.667Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T21:48:11.452Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:11.464Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:20.052Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:20.063Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:22.651Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:22.674Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:24.399Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:24.422Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:38.205Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:38.244Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:40.013Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:40.022Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:44.073Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:44.088Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:49.343Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:49.361Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:55.607Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:55.630Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:57.473Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29
- `2026-04-12T21:48:57.499Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=29
- `2026-04-12T21:48:59.317Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=29

## Test Log
```
[21:47:42] ═══ PHASE 0: SETUP ═══
[21:47:42] Homeserver OK — versions: v1.11, v1.12
[21:47:42]   User @testuser1 — logged in (existing)
[21:47:44]   Cleaned up 6/6 old device(s) for testuser1
[21:47:44]   Deleted old key backup v28 for testuser1
[21:47:44]   User @testuser2 — logged in (existing)
[21:47:46]   Cleaned up 5/5 old device(s) for testuser2
[21:47:46]   Deleted old key backup v24 for testuser2
[21:47:46] Cleanup: purging stale test rooms from previous runs...
[21:47:46]   No stale test rooms found
[21:47:46] Creating test rooms...
[21:47:47]   Room "QA General" — !xslMcxlxErhhuCbogA:localhost
[21:47:48]   DM room — !KHZgzpvlxNcbZyzkJA:localhost
[21:47:48]   Room "QA Empty Room" — !MWFYTCpYqIDGxhZGkB:localhost
[21:47:49]   Room "QA Encrypted" — !KkdwuoFnzNjSigzcUj:localhost (E2E enabled)
[21:47:50]   Room "QA Media" — !BjrilqSzKuNTlMiItz:localhost
[21:47:50] Populating "QA General" with messages...
[21:47:57]   Sent 12 messages
[21:47:57]   Poll created — $lyTglKjWKo4AWdM_pfpxis8CHxL3lga7u4RjWbeba4w
[21:47:57] Populating DM with messages...
[21:47:58]   Sent 3 DM messages
[21:47:58] Display names set
[21:47:58] ═══ SETUP COMPLETE ═══
[21:47:58]   Users: @testuser1:localhost, @testuser2:localhost
[21:47:58]   Rooms: general=!xslMcxlxErhhuCbogA:localhost, dm=!KHZgzpvlxNcbZyzkJA:localhost, empty=!MWFYTCpYqIDGxhZGkB:localhost, media=!BjrilqSzKuNTlMiItz:localhost
[21:47:59] ═══ PHASE 1: DISCOVERY ═══
[21:48:01] Start URL: http://localhost:5173/login
[21:48:01] Interactive elements on start page: 6
[21:48:01] --- AUTH_LOGIN ---
[21:48:08] AUTH_LOGIN: PASS
[21:48:08] ═══ POST-AUTH DISCOVERY ═══
[21:48:11] Rooms visible: 10
[21:48:11] Search input: true
[21:48:11] Create room btn: true
[21:48:11] Settings btn: true
[21:48:11] Saved messages btn: true
[21:48:11] Room list header: "Chatsv1.0.0"
[21:48:11] --- ROOM_LIST_DISPLAY ---
[21:48:12] Room item: name=true, preview=true, time=true, avatar=true
[21:48:12] Unread badges visible: 1
[21:48:12] Status icons (encrypted/muted/pinned): 1
[21:48:12] --- ROOM_SEARCH ---
[21:48:16] ROOM_SEARCH: dropdown=true, results=16
[21:48:19] ROOM_SEARCH: PASS
[21:48:19] --- ROOM_LIST_CONTEXT_MENU ---
[21:48:21] ROOM_LIST_CONTEXT_MENU: Actions: Saved Messages | Все сообщения | Только упоминания | Mute notifications | Mark as unread | Pin | Low priority | Add to space | Archive | Leave
[21:48:22] --- ROOM_SWITCH ---
[21:48:39] Room view: header=true, composer=true, timeline=true
[21:48:43] ROOM_SWITCH: Successfully switched rooms (http://localhost:5173/rooms/!xslMcxlxErhhuCbogA%3Alocalhost -> http://localhost:5173/rooms/!HLoBNJnfEjlOEyYoHb%3Alocalhost)
[21:48:43] --- ROOM_CREATE ---
[21:48:46] ROOM_CREATE: Tabs found: 3
[21:48:46] ROOM_CREATE: Input fields: 3
[21:48:47] ROOM_CREATE (DM tab): Visible inputs: 3
[21:48:49] --- ROOM_HEADER ---
[21:48:50] ROOM_HEADER: name="QA Empty Room", avatar=true, invite=true, info=true
[21:48:52] ROOM_HEADER: Details panel opened: true
[21:48:54] ROOM_HEADER: Invite dialog opened: true
[21:48:55] --- EMPTY_ROOM ---
[21:48:57] EMPTY_ROOM: empty indicator=false, messages=2
[21:48:57] --- DM_ROOM ---
[21:48:58] DM_ROOM: Header subtitle: "online"
[21:48:58] DM_ROOM: Online indicator: false
[21:48:58] DM_ROOM: Messages visible: 13
[21:48:58] --- TIMELINE_SCROLL ---
[21:49:00] TIMELINE_SCROLL: Initial messages: 15
[21:49:00] TIMELINE_SCROLL: Typing indicator area: false
[21:49:00] TIMELINE_SCROLL: Pinned message bar: false
[21:49:00] --- CHAT_SEND_MESSAGE ---
[21:49:10] CHAT_SEND_MESSAGE: Message sent (textarea cleared) but not yet visible — likely E2E encryption delay
[21:49:10] --- CHAT_SEND_ENTER ---
[21:49:18] CHAT_SEND_ENTER: PASS — textarea cleared (message sent, E2E delay)
[21:49:18] --- CHAT_SHIFT_ENTER ---
[21:49:19] CHAT_SHIFT_ENTER: PASS — value has newline: true
[21:49:20] --- CHAT_SEND_EMPTY ---
[21:49:20] --- CHAT_LONG_MESSAGE ---
[21:49:20] --- CHAT_SPECIAL_CHARS ---
[21:49:20] --- ATTACH_MENU ---
[21:49:21] ATTACH_MENU: Items: Start poll | Send image | Send video | Send file
[21:49:21] ATTACH_MENU: File input accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
[21:49:21] --- MESSAGE_BUBBLE ---
[21:49:21] MESSAGE_BUBBLE: 15 messages visible
[21:49:21] MESSAGE_BUBBLE: bubble=true, time=true, content=true
[21:49:21] MESSAGE_BUBBLE: Date separators: 0
[21:49:21] MESSAGE_BUBBLE: Messages with reactions: 0
[21:49:21] MESSAGE_BUBBLE: Thread badges: 0
[21:49:21] MESSAGE_BUBBLE: Edited messages: 0
[21:49:21] MESSAGE_BUBBLE: Read receipts: 9
[21:49:21] --- MSG_CONTEXT_MENU ---
[21:49:23] MSG_CONTEXT_MENU: Actions: Reply | Edit | Copy text | Copy link to message | Forward | Thread | Select | React | Delete (DANGER)
[21:49:23] MSG_CONTEXT_MENU: Receipts row: true
[21:49:23] MSG_CONTEXT_MENU: Closes on Escape
[21:49:23] --- MSG_REPLY ---
[21:49:25] MSG_REPLY: Reply preview shown, cancel btn: true
[21:49:28] MSG_REPLY: Reply quote visible: false
[21:49:28] --- MSG_EDIT ---
[21:49:30] MSG_EDIT: Edit mode activated with preview
[21:49:30] MSG_EDIT: Textarea pre-filled: "..."
[21:49:32] MSG_EDIT: Edited badge visible: false
[21:49:32] --- MSG_EDIT_CANCEL ---
[21:49:34] MSG_EDIT_CANCEL: PASS — Escape cancels edit
[21:49:34] --- MSG_FORWARD ---
[21:49:36] MSG_FORWARD: Search: true, rooms: 71
[21:49:37] --- MSG_SELECT ---
[21:49:39] MSG_SELECT: Selection count: "1 selected"
[21:49:39] MSG_SELECT: Selection action buttons: 4
[21:49:39] MSG_SELECT: Checkboxes visible: 6
[21:49:40] MSG_SELECT: After selecting 2nd: "2 selected"
[21:49:40] MSG_SELECT: Selection cancelled: true
[21:49:40] --- MSG_COPY ---
[21:49:41] MSG_COPY: Copy action clicked
[21:49:42] --- MSG_THREAD ---
[21:49:45] MSG_THREAD: Thread panel opened
[21:49:45] --- MSG_REACT ---
[21:49:48] MSG_REACT: Emoji picker opened
[21:49:49] --- MSG_DELETE ---
[21:49:54] MSG_DELETE: Redacted message visible: false
[21:49:59] Key restore screen detected — clicking Skip
[21:50:03] --- SETTINGS_NAV ---
[21:50:04] Key restore screen detected — clicking Skip
[21:50:07] SETTINGS_NAV: Sections: Profile, Appearance, Devices, Encryption, Language, Notifications, Приватность
[21:50:08] SETTINGS_NAV: Visited profile
[21:50:10] SETTINGS_NAV: Visited appearance
[21:50:12] SETTINGS_NAV: Visited devices
[21:50:14] SETTINGS_NAV: Visited encryption
[21:50:15] SETTINGS_NAV: Visited language
[21:50:17] SETTINGS_NAV: Visited notifications
[21:50:19] SETTINGS_NAV: Visited приватность
[21:50:19] --- SETTINGS_PROFILE ---
[21:50:21] Key restore screen detected — clicking Skip
[21:50:23] SETTINGS_PROFILE: Avatar: true
[21:50:23] SETTINGS_PROFILE: Display name: ""
[21:50:23] SETTINGS_PROFILE: Change avatar button: true
[21:50:23] SETTINGS_PROFILE: User ID visible: true
[21:50:23] SETTINGS_PROFILE: Save button: true
[21:50:23] --- SETTINGS_APPEARANCE ---
[21:50:25] Key restore screen detected — clicking Skip
[21:50:27] SETTINGS_APPEARANCE: Theme options: 4
[21:50:27] SETTINGS_APPEARANCE: Current theme: "System"
[21:50:29] SETTINGS_APPEARANCE: Theme switch works
[21:50:29] --- QUICK_REACTIONS ---
[21:50:31] Key restore screen detected — clicking Skip
[21:50:33] QUICK_REACTIONS: No messages, skipping
[21:50:33] --- HASHTAG_RENDER ---
[21:50:33] --- AT_ROOM_MENTION ---
[21:50:35] AT_ROOM_MENTION: PASS — @room option visible
[21:50:35] --- REPLY_TRUNCATION ---
[21:50:35] REPLY_TRUNCATION: No reply quotes visible, skipping
[21:50:35] --- DRAFT_PERSIST ---
[21:50:37] Key restore screen detected — clicking Skip
[21:50:42] Key restore screen detected — clicking Skip
[21:50:46] DRAFT_PERSIST: Draft not restored (got "", expected "Draft test 1776030635523")
[21:50:46] --- IMAGE_CAPTION ---
[21:50:46] IMAGE_CAPTION: Attach button present (caption UI added to ImagePreviewDialog)
[21:50:46] --- MENTION_BADGE_LIST ---
[21:50:48] Key restore screen detected — clicking Skip
[21:50:52] MENTION_BADGE_LIST: Mention sent — event $G_QYMf6YRSWVdq1YH6TQZFi4aqOqWyYa6nsUX9bB20k
[21:50:58] Key restore screen detected — clicking Skip
[21:51:02] MENTION_BADGE_LIST: @ icons in room list: 0
[21:51:02] BUG [LOW] MENTION_BADGE_LIST: @ icon not visible (Synapse push rules may not process m.mentions API messages as highlights)
[21:51:02] --- MENTION_SCROLL_ENTER ---
[21:51:04] Key restore screen detected — clicking Skip
[21:51:14] Key restore screen detected — clicking Skip
[21:51:21] MENTION_SCROLL_ENTER: PASS — URL has eventId parameter
[21:51:21] --- MENTION_NAVIGATOR ---
[21:51:26] Key restore screen detected — clicking Skip
[21:51:30] MENTION_NAVIGATOR: Navigator button not visible (highlightCount may be 0)
[21:51:30] --- MENTIONED_BUBBLE ---
[21:51:32] Key restore screen detected — clicking Skip
[21:51:36] MENTIONED_BUBBLE: 3 mentioned message(s) visible
[21:51:36] MENTIONED_BUBBLE: PASS — mention highlight class applied
[21:51:36] --- ROOM_MENTION ---
[21:51:38] Key restore screen detected — clicking Skip
[21:51:42] ROOM_MENTION: @room message sent
[21:51:48] Key restore screen detected — clicking Skip
[21:51:52] ROOM_MENTION: @ icons after @room: 0
[21:51:52] BUG [LOW] ROOM_MENTION: @room mention did not trigger highlight badge
[21:51:52] --- REACTION_STABILITY ---
[21:51:54] Key restore screen detected — clicking Skip
[21:51:57] REACTION_STABILITY: First reaction added
[21:52:00] REACTION_STABILITY: PASS — reaction persists after sync
[21:52:00] --- REACTION_RAPID_CLICKS ---
[21:52:04] REACTION_RAPID_CLICKS: Reactions still present after rapid clicks: false
[21:52:04] --- TIMELINE_NO_JITTER ---
[21:52:06] Key restore screen detected — clicking Skip
[21:52:11] TIMELINE_NO_JITTER: Reply preview set
[21:52:14] TIMELINE_NO_JITTER: PASS — reply preview preserved
[21:52:14] TIMELINE_NO_JITTER: Scroll before=0, after=0
[21:52:17] --- PIN_MESSAGE_LIVE ---
[21:52:17] --- PRIVACY_SETTINGS ---
[21:52:19] Key restore screen detected — clicking Skip
[21:52:23] PRIVACY_SETTINGS: 2 privacy toggles found
[21:52:23] PRIVACY_SETTINGS: PASS
[21:52:23] PRIVACY_SETTINGS: Deactivate button: true
[21:52:23] --- IDLE_LOGOUT_SETTING ---
[21:52:24] Key restore screen detected — clicking Skip
[21:52:28] IDLE_LOGOUT_SETTING: 6 timeout options
[21:52:28] IDLE_LOGOUT_SETTING: PASS
[21:52:28] --- VOICE_BUTTON ---
[21:52:29] Key restore screen detected — clicking Skip
[21:52:32] VOICE_BUTTON: No send button area
[21:52:32] --- SLASH_COMMANDS ---
[21:52:32] --- SEND_QUEUE_DB ---
[21:52:32] SEND_QUEUE_DB: send queue store exists: true
[21:52:32] --- SAVED_MESSAGES_NO_DUP ---
[21:52:34] Key restore screen detected — clicking Skip
[21:52:42] Key restore screen detected — clicking Skip
[21:52:48] SAVED_MESSAGES_NO_DUP: PASS — same room opened twice
[21:52:48] --- ENCRYPTED_RECOVERY_KEY ---
[21:52:48] ENCRYPTED_RECOVERY_KEY: shape=null, encrypted=false
[21:52:48] --- LOGGER_MODULE ---
[21:52:48] LOGGER_MODULE: App loaded OK at http://localhost:5173/rooms/!MWFYTCpYqIDGxhZGkB%3Alocalhost
[21:52:48] --- TOUCH_TARGETS ---
[21:52:50] Key restore screen detected — clicking Skip
[21:52:54] TOUCH_TARGETS: PASS
[21:52:54] --- SKIP_LINK ---
[21:52:56] Key restore screen detected — clicking Skip
[21:52:59] SKIP_LINK: PASS
[21:52:59] --- CROSS_SIGNING_UI_PRESENT ---
[21:53:01] Key restore screen detected — clicking Skip
[21:53:05] CROSS_SIGNING_UI_PRESENT: Verify button: true
[21:53:05] --- ROOM_LIST_TABS ---
[21:53:07] Key restore screen detected — clicking Skip
[21:53:10] ROOM_LIST_TABS: 4 tab buttons
[21:53:12] ROOM_LIST_TABS: Unread tab clicked
[21:53:14] ROOM_LIST_TABS: PASS
[21:53:14] --- ROOM_NOTIFY_LEVELS ---
[21:53:16] Key restore screen detected — clicking Skip
[21:53:20] ROOM_NOTIFY_LEVELS: PASS — All/Mentions/Mute available
[21:53:20] --- EMOJI_AUTOCOMPLETE ---
[21:53:22] Key restore screen detected — clicking Skip
[21:53:26] EMOJI_AUTOCOMPLETE: PASS — popup with emoji candidates
[21:53:26] --- MULTI_FILE_INPUT ---
[21:53:26] MULTI_FILE_INPUT: PASS — multiple attribute set
[21:53:26] --- LIGHTBOX_NAV ---
[21:53:26] LIGHTBOX_NAV: skipped (requires media setup)
[21:53:26] --- MEMBER_ACTIONS ---
[21:53:28] MEMBER_ACTIONS: 0 action buttons found
[21:53:29] --- ROOM_NAME_EDITABLE ---
[21:53:31] ROOM_NAME_EDITABLE: No room name element
[21:53:31] --- FREQUENT_EMOJI ---
[21:53:31] FREQUENT_EMOJI: localStorage value: present
[21:53:31] --- I18N_CLEANUP ---
[21:53:33] Key restore screen detected — clicking Skip
[21:53:39] I18N_CLEANUP: Settings page loaded OK
[21:53:39] --- HIGH_CONTRAST_CSS ---
[21:53:39] HIGH_CONTRAST_CSS: PASS — @media (prefers-contrast) detected
[21:53:39] --- CALL_BUTTONS_DM ---
[21:53:41] Key restore screen detected — clicking Skip
[21:53:47] CALL_BUTTONS_DM: header buttons: Голосовой звонок | Видеозвонок | Invite user
[21:53:47] CALL_BUTTONS_DM: PASS
[21:53:47] --- INCOMING_CALL_CONTAINER ---
[21:53:49] Key restore screen detected — clicking Skip
[21:53:54] INCOMING_CALL_CONTAINER: PASS — app loaded with global CallContainer
[21:53:54] --- MEMBER_ONLINE ---
[21:53:55] Key restore screen detected — clicking Skip
[21:54:05] MEMBER_ONLINE: 9 avatars in room details
[21:54:05] --- ROOM_AVATAR_EDIT ---
[21:54:07] ROOM_AVATAR_EDIT: Avatar upload label: false
[21:54:07] --- SPACES_CONTEXT ---
[21:54:09] Key restore screen detected — clicking Skip
[21:54:14] SPACES_CONTEXT: No spaces button (no spaces created)
[21:54:14] --- BUNDLE_VISUALIZER ---
[21:54:14] BUNDLE_VISUALIZER: PASS — installed v^7.0.1
[21:54:14] --- CONTRAST_FIX ---
[21:54:16] Key restore screen detected — clicking Skip
[21:54:20] CONTRAST_FIX: --color-text-secondary = #5a627a
[21:54:20] CONTRAST_FIX: PASS — improved to #5a627a
[21:54:20] --- SYNC_PERSISTED ---
[21:54:20] SYNC_PERSISTED: corp-matrix-sync DB exists: true
[21:54:20] SYNC_PERSISTED: PASS
[21:54:20] --- LAZY_CHUNKS ---
[21:54:22] Key restore screen detected — clicking Skip
[21:54:28] LAZY_CHUNKS: Lightbox loaded initially: false
[21:54:28] LAZY_CHUNKS: EmojiPicker loaded initially: false
[21:54:28] --- SWIPE_REPLY ---
[21:54:30] Key restore screen detected — clicking Skip
[21:54:35] SWIPE_REPLY: No message, skipping
[21:54:35] --- THREAD_BACK_BUTTON ---
[21:54:36] --- XSS_SANITIZATION ---
[21:54:36] --- ERROR_BOUNDARY ---
[21:54:36] ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)
[21:54:36] --- CRYPTO_BANNER ---
[21:54:37] Key restore screen detected — clicking Skip
[21:54:41] CRYPTO_BANNER: PASS — no warning banner (crypto is working)
[21:54:41] --- SEND_ERROR_FEEDBACK ---
[21:54:43] Key restore screen detected — clicking Skip
[21:54:47] SEND_ERROR_FEEDBACK: Textarea aria-label="Type a message..."
[21:54:47] SEND_ERROR_FEEDBACK: PASS
[21:54:47] --- TIMELINE_A11Y ---
[21:54:47] TIMELINE_A11Y: role="log" found, aria-live="polite"
[21:54:47] TIMELINE_A11Y: Composer form has role="form"
[21:54:47] TIMELINE_A11Y: PASS
[21:54:47] --- SECURITY_HEADERS ---
[21:54:47] SECURITY_HEADERS: Page loaded OK (CSP not blocking app)
[21:54:47] SECURITY_HEADERS: CSP meta tag: false
[21:54:47] --- ENCRYPTION_SETTINGS ---
[21:54:49] Key restore screen detected — clicking Skip
[21:55:07] ENCRYPTION_SETTINGS: Key backup button: false
[21:55:07] ENCRYPTION_SETTINGS: Has backup-related content: true
[21:55:07] --- DEVICES_SETTINGS ---
[21:55:09] Key restore screen detected — clicking Skip
[21:55:15] DEVICES_SETTINGS: Device elements: 3
[21:55:15] DEVICES_SETTINGS: Current device indicator: true
[21:55:15] DEVICES_SETTINGS: Device IDs found: 1
[21:55:15] --- DEVICE_PROLIFERATION ---
[21:55:15] DEVICE_PROLIFERATION: Total devices for @testuser1:localhost: 3
[21:55:15]   Device: HBVDXUUVIL | name="-" | last_seen=2026-04-12T21:55:15
[21:55:15]   Device: KWHXFDQPDO | name="-" | last_seen=2026-04-12T21:48:05
[21:55:15]   Device: YQATJPDGUE | name="-" | last_seen=2026-04-12T21:54:04
[21:55:15] --- KEY_BACKUP_STATUS ---
[21:55:15] KEY_BACKUP_STATUS: Backup exists — version=29, algorithm=m.megolm_backup.v1.curve25519-aes-sha2
[21:55:15] --- ENCRYPTED_MESSAGES ---
[21:55:17] Key restore screen detected — clicking Skip
[21:55:23] ENCRYPTED_MESSAGES: No UTD indicators found
[21:55:23] ENCRYPTED_MESSAGES: Encryption badge in header: false
[21:55:23] --- CROSS_SIGNING_UI ---
[21:55:25] Key restore screen detected — clicking Skip
[21:55:43] CROSS_SIGNING_UI: Verify button: true
[21:55:43] CROSS_SIGNING_UI: Cross-signing info: true, Verification info: true
[21:55:43] --- D1_CONTEXT_REACTIVITY ---
[21:55:45] Key restore screen detected — clicking Skip
[21:55:59] Key restore screen detected — clicking Skip
[21:56:07] Key restore screen detected — clicking Skip
[21:56:13] D1_CONTEXT_REACTIVITY: PASS
[21:56:13] --- CREATE_POLL ---
[21:56:15] Key restore screen detected — clicking Skip
[21:56:30] CREATE_POLL: PASS
[21:56:30] --- POLL_VOTE ---
[21:56:32] Key restore screen detected — clicking Skip
[21:56:36] POLL_VOTE: SKIP (no poll from previous test)
[21:56:36] --- READ_RECEIPTS_VISUAL ---
[21:56:44] READ_RECEIPTS_VISUAL: PASS
[21:56:44] --- TYPING_INDICATOR ---
[21:57:01] Room entered but composer not found
[21:57:03] --- INVITE_ACCEPT_DECLINE ---
[21:57:11] Key restore screen detected — clicking Skip
[21:57:18] INVITE_ACCEPT_DECLINE: PASS
[21:57:18] --- CREATE_SPACE ---
[21:57:20] Key restore screen detected — clicking Skip
[21:57:27] CREATE_SPACE: SKIP (modal is not "create space")
[21:57:27] --- MESSAGE_SEARCH_WIRED ---
[21:57:29] Key restore screen detected — clicking Skip
[21:57:36] MESSAGE_SEARCH_WIRED: PASS — search button opens SearchPanel modal
[21:57:36] --- KEY_RESTORE_METHODS ---
[21:57:36] KEY_RESTORE_METHODS: SKIP (screen not visible, keys already loaded)
[21:57:36] --- NETWORK_RECONNECT ---
[21:57:38] Key restore screen detected — clicking Skip
[21:57:49] BUG [LOW] NO_OFFLINE_INDICATOR: No visible offline/reconnection indicator while context is offline
[21:57:55] NETWORK_RECONNECT: PASS
[21:57:55] --- SW_REGISTERED ---
[21:57:57] Key restore screen detected — clicking Skip
[21:58:02] SW: controller=http://localhost:5173/dev-sw.js?dev-sw, registrations=1
[21:58:02] SW_REGISTERED: PASS
[21:58:02] --- SCROLL_AFTER_SEND ---
[21:58:02] SCROLL_AFTER_SEND: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:02] --- SCROLL_TO_BOTTOM_FAB ---
[21:58:03] SCROLL_FAB: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:03] --- OFFLINE_BANNER ---
[21:58:04] Key restore screen detected — clicking Skip
[21:58:20] OFFLINE_BANNER: banner found with text "⟳Переподключение..."
[21:58:23] OFFLINE_BANNER: PASS — banner disappeared after reconnect
[21:58:23] --- TYPING_TIMEOUT ---
[21:58:29] Key restore screen detected — clicking Skip
[21:58:32] TYPING_TIMEOUT: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:32] --- FORWARD_COMPLETE ---
[21:58:33] FORWARD_COMPLETE: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:33] --- VOICE_RECORD_FLOW ---
[21:58:33] VOICE_RECORD_FLOW: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:33] --- CONTEXT_MENU_ALL_ACTIONS ---
[21:58:33] CTX_MENU_ALL_ACTIONS: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:33] --- MOBILE_LONG_PRESS ---
[21:58:33] MOBILE_LONG_PRESS: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:33] --- REPLY_QUOTE ---
[21:58:34] REPLY_QUOTE: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!xslMcxlxErhhuCbogA:localhost", waiting until "domcontentloaded"[22m

[21:58:34] --- FORWARD_E2E_WARNING ---
[21:58:34] FORWARD_E2E_WARNING: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!KkdwuoFnzNjSigzcUj:localhost", waiting until "domcontentloaded"[22m

[21:58:34] --- STRESS_MESSAGES ---
[21:58:49] STRESS_MESSAGES: new console errors=0
[21:58:49] STRESS_MESSAGES: PASS
[21:58:49] --- RESPONSIVE_MOBILE ---
[21:58:56] Key restore screen detected — clicking Skip
[21:59:06] RESPONSIVE_mobile: Back button in room: false
[21:59:06] RESPONSIVE_mobile: Composer visible: true
[21:59:08] Key restore screen detected — clicking Skip
[21:59:12] --- RESPONSIVE_TABLET ---
[21:59:18] Key restore screen detected — clicking Skip
[21:59:28] RESPONSIVE_tablet: Back button in room: false
[21:59:28] RESPONSIVE_tablet: Composer visible: true
[21:59:30] Key restore screen detected — clicking Skip
[21:59:35] ═══ MULTI-USER TEST ═══
[21:59:41] Key restore screen detected — clicking Skip
[21:59:44] MULTI_USER: User2 logged in
[21:59:53] Key restore screen detected — clicking Skip
[21:59:59] --- SETTINGS_LOGOUT ---
[22:00:01] Key restore screen detected — clicking Skip
[22:00:08] SETTINGS_LOGOUT: Modal text: "Вы уверены, что хотите выйти из аккаунта?"
[22:00:08] SETTINGS_LOGOUT: Cancel closes modal: true
[22:00:15] SETTINGS_LOGOUT: PASS — redirected to /login
[22:00:15] --- AUTH_EMPTY ---
[22:00:20] AUTH_EMPTY: PASS — validation works
[22:00:20] --- AUTH_WRONG_CREDS ---
[22:00:30] AUTH_WRONG_CREDS: PASS — error: "MatrixError: [403] Invalid username or password (http://127.0.0.1:8008/_matrix/client/v3/login)"
[22:00:30] --- REGISTER_PAGE ---
[22:00:34] Register page has 4 input fields
[22:00:34] REGISTER_PAGE: Login link present
[22:00:34] --- REGISTER_MISMATCH ---
[22:00:41] REGISTER_MISMATCH: PASS — error shown for mismatch
[22:00:41] --- CONSOLE_ERRORS ---
[22:00:41] CONSOLE_ERRORS: None (112 filtered as harmless)
[22:00:41] --- NETWORK_ERRORS ---
[22:00:41] NETWORK_ERRORS: None
[22:00:41] ═══ POST-RUN CLEANUP ═══
[22:00:41] Cleanup: purging stale test rooms from previous runs...
[22:00:43]   No stale test rooms found
```
