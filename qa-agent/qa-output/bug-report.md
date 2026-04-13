# Bug Report — Corp Matrix Web

**Date:** 2026-04-13
**App URL:** http://localhost:5173
**Homeserver:** http://127.0.0.1:8008
**Total bugs:** 4

## Summary
| Severity | Count |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 2 |
| 🟡 MEDIUM | 0 |
| 🟢 LOW | 2 |

## Bugs
| # | Severity | Scenario | Description | Steps | Screenshot |
|---|---|---|---|---|---|
| 1 | 🟢 LOW | MENTION_BADGE_LIST | @ icon not visible (Synapse push rules may not process m.mentions API messages as highlights) | 1. Send mention to user from another account 2. Open room list 3. @ icon should appear next to the room | [screenshot](screenshots/042-mention-badge-list.png) |
| 2 | 🟢 LOW | ROOM_MENTION | @room mention did not trigger highlight badge |  | - |
| 3 | 🟠 HIGH | CONSOLE_ERRORS | React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from a parent component, remove it from the DOM elemen | Captured from browser console | - |
| 4 | 🟠 HIGH | CONSOLE_ERRORS | Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAA0 already exists. Old key: {"key":"WG0/pDHOjV1g2oCrlfDzwBK+ZoKuciU0Ux6FhBdrFx0","signatures":{"@testuser1:localhost":{"ed25519:HMBOBJVEHI":"S | Captured from browser console | - |

## Console Errors
- `2026-04-13T00:26:00.435Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:01.401Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:01.408Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:01.456Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:06.085Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:07.902Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:08.214Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:08.234Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:14.699Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:15.015Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:15.035Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:17.335Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:17.639Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:17.660Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:19.094Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:19.403Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:19.433Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:19.676Z` [main] React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from
- `2026-04-13T00:26:32.862Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:33.212Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:33.262Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:33.448Z` [main] React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from
- `2026-04-13T00:26:34.694Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/groupCallEventHandler-p_dmpOwx.js?v=b4ba78fd:17516:11
    at Generator.throw (<a
- `2026-04-13T00:26:35.008Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-13T00:26:35.032Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)

## Network Errors
- `2026-04-13T00:26:00.435Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-13T00:26:01.401Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-13T00:26:01.408Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-13T00:26:01.456Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-13T00:26:08.214Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:08.234Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:15.015Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:15.035Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:17.639Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:17.659Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:19.403Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:19.433Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:33.212Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:33.262Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:35.008Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:35.032Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:39.056Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:39.078Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:44.345Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:44.370Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:49.896Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:49.937Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:51.697Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32
- `2026-04-13T00:26:51.722Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=32
- `2026-04-13T00:26:53.500Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=32

## Test Log
```
[00:25:37] ═══ PHASE 0: SETUP ═══
[00:25:37] Homeserver OK — versions: v1.11, v1.12
[00:25:38]   User @testuser1 — logged in (existing)
[00:25:40]   Cleaned up 6/6 old device(s) for testuser1
[00:25:40]   Deleted old key backup v31 for testuser1
[00:25:40]   User @testuser2 — logged in (existing)
[00:25:41]   Cleaned up 5/5 old device(s) for testuser2
[00:25:41]   Deleted old key backup v27 for testuser2
[00:25:41] Cleanup: purging stale test rooms from previous runs...
[00:25:42]   No stale test rooms found
[00:25:42] Creating test rooms...
[00:25:43]   Room "QA General" — !UbMotTGhbQiVNxhJEJ:localhost
[00:25:43]   DM room — !QVZgRyfnPnMJTnMopA:localhost
[00:25:44]   Room "QA Empty Room" — !juPQuWKVwKeanEOnKY:localhost
[00:25:45]   Room "QA Encrypted" — !XFaArVAXKOLrhktSUh:localhost (E2E enabled)
[00:25:45]   Room "QA Media" — !LFjYRmrOxVHnTswibV:localhost
[00:25:45] Populating "QA General" with messages...
[00:25:52]   Sent 12 messages
[00:25:52]   Poll created — $QaExp5Y3J8ocJyV5ZNCU_ukN2JpT5OTOJxEkTBcih2Y
[00:25:52] Populating DM with messages...
[00:25:54]   Sent 3 DM messages
[00:25:54] Display names set
[00:25:54] ═══ SETUP COMPLETE ══��
[00:25:54]   Users: @testuser1:localhost, @testuser2:localhost
[00:25:54]   Rooms: general=!UbMotTGhbQiVNxhJEJ:localhost, dm=!QVZgRyfnPnMJTnMopA:localhost, empty=!juPQuWKVwKeanEOnKY:localhost, media=!LFjYRmrOxVHnTswibV:localhost
[00:25:54] ═══ PHASE 1: DISCOVERY ═══
[00:25:57] Start URL: http://localhost:5173/login
[00:25:57] Interactive elements on start page: 6
[00:25:57] --- AUTH_LOGIN ---
[00:26:04] AUTH_LOGIN: PASS
[00:26:04] ═══ POST-AUTH DISCOVERY ═══
[00:26:06] Rooms visible: 10
[00:26:06] Search input: true
[00:26:06] Create room btn: true
[00:26:06] Settings btn: true
[00:26:06] Saved messages btn: true
[00:26:06] Room list header: "Chatsv1.0.0"
[00:26:06] --- ROOM_LIST_DISPLAY ---
[00:26:07] Room item: name=true, preview=true, time=true, avatar=true
[00:26:07] Unread badges visible: 1
[00:26:07] Status icons (encrypted/muted/pinned): 1
[00:26:07] --- ROOM_SEARCH ---
[00:26:11] ROOM_SEARCH: dropdown=true, results=16
[00:26:14] ROOM_SEARCH: PASS
[00:26:14] --- ROOM_LIST_CONTEXT_MENU ---
[00:26:16] ROOM_LIST_CONTEXT_MENU: Actions: Saved Messages | Все сообщения | Только упоминания | Mute notifications | Mark as unread | Pin | Low priority | Add to space | Archive | Leave
[00:26:17] --- ROOM_SWITCH ---
[00:26:34] Room view: header=true, composer=true, timeline=true
[00:26:38] ROOM_SWITCH: Successfully switched rooms (http://localhost:5173/rooms/!UbMotTGhbQiVNxhJEJ%3Alocalhost -> http://localhost:5173/rooms/!HLoBNJnfEjlOEyYoHb%3Alocalhost)
[00:26:38] --- ROOM_CREATE ---
[00:26:41] ROOM_CREATE: Tabs found: 3
[00:26:41] ROOM_CREATE: Input fields: 3
[00:26:42] ROOM_CREATE (DM tab): Visible inputs: 3
[00:26:43] --- ROOM_HEADER ---
[00:26:45] ROOM_HEADER: name="QA Empty Room", avatar=true, invite=true, info=true
[00:26:47] ROOM_HEADER: Details panel opened: true
[00:26:49] ROOM_HEADER: Invite dialog opened: false
[00:26:49] --- EMPTY_ROOM ---
[00:26:51] EMPTY_ROOM: empty indicator=false, messages=2
[00:26:51] --- DM_ROOM ---
[00:26:53] DM_ROOM: Header subtitle: "online"
[00:26:53] DM_ROOM: Online indicator: false
[00:26:53] DM_ROOM: Messages visible: 13
[00:26:53] --- TIMELINE_SCROLL ---
[00:26:54] TIMELINE_SCROLL: Initial messages: 15
[00:26:54] TIMELINE_SCROLL: Typing indicator area: false
[00:26:54] TIMELINE_SCROLL: Pinned message bar: false
[00:26:54] --- CHAT_SEND_MESSAGE ---
[00:27:04] CHAT_SEND_MESSAGE: Message sent (textarea cleared) but not yet visible — likely E2E encryption delay
[00:27:04] --- CHAT_SEND_ENTER ---
[00:27:12] CHAT_SEND_ENTER: PASS — textarea cleared (message sent, E2E delay)
[00:27:12] --- CHAT_SHIFT_ENTER ---
[00:27:14] CHAT_SHIFT_ENTER: PASS — value has newline: true
[00:27:14] --- CHAT_SEND_EMPTY ---
[00:27:14] --- CHAT_LONG_MESSAGE ---
[00:27:14] --- CHAT_SPECIAL_CHARS ---
[00:27:14] --- ATTACH_MENU ---
[00:27:15] ATTACH_MENU: Items: Start poll | Send image | Send video | Send file
[00:27:15] ATTACH_MENU: File input accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
[00:27:15] --- MESSAGE_BUBBLE ---
[00:27:16] MESSAGE_BUBBLE: 15 messages visible
[00:27:16] MESSAGE_BUBBLE: bubble=true, time=true, content=true
[00:27:16] MESSAGE_BUBBLE: Date separators: 0
[00:27:16] MESSAGE_BUBBLE: Messages with reactions: 0
[00:27:16] MESSAGE_BUBBLE: Thread badges: 0
[00:27:16] MESSAGE_BUBBLE: Edited messages: 0
[00:27:16] MESSAGE_BUBBLE: Read receipts: 9
[00:27:16] --- MSG_CONTEXT_MENU ---
[00:27:17] MSG_CONTEXT_MENU: Actions: Reply | Edit | Copy text | Copy link to message | Forward | Thread | Select | React | Delete (DANGER)
[00:27:17] MSG_CONTEXT_MENU: Receipts row: true
[00:27:17] MSG_CONTEXT_MENU: Closes on Escape
[00:27:17] --- MSG_REPLY ---
[00:27:19] MSG_REPLY: Reply preview shown, cancel btn: true
[00:27:22] MSG_REPLY: Reply quote visible: false
[00:27:22] --- MSG_EDIT ---
[00:27:24] MSG_EDIT: Edit mode activated with preview
[00:27:24] MSG_EDIT: Textarea pre-filled: "..."
[00:27:26] MSG_EDIT: Edited badge visible: false
[00:27:26] --- MSG_EDIT_CANCEL ---
[00:27:28] MSG_EDIT_CANCEL: PASS — Escape cancels edit
[00:27:28] --- MSG_FORWARD ---
[00:27:31] MSG_FORWARD: Search: true, rooms: 78
[00:27:31] --- MSG_SELECT ---
[00:27:33] MSG_SELECT: Selection count: "1 selected"
[00:27:33] MSG_SELECT: Selection action buttons: 4
[00:27:33] MSG_SELECT: Checkboxes visible: 6
[00:27:34] MSG_SELECT: After selecting 2nd: "2 selected"
[00:27:35] MSG_SELECT: Selection cancelled: true
[00:27:35] --- MSG_COPY ---
[00:27:36] MSG_COPY: Copy action clicked
[00:27:36] --- MSG_THREAD ---
[00:27:39] MSG_THREAD: Thread panel opened
[00:27:40] --- MSG_REACT ---
[00:27:42] MSG_REACT: Emoji picker opened
[00:27:43] --- MSG_DELETE ---
[00:27:48] MSG_DELETE: Redacted message visible: false
[00:27:53] Key restore screen detected — clicking Skip
[00:27:57] --- SETTINGS_NAV ---
[00:27:59] Key restore screen detected — clicking Skip
[00:28:01] SETTINGS_NAV: Sections: Profile, Appearance, Devices, Encryption, Language, Notifications, Приватность
[00:28:03] ERROR in settings section: elementHandle.textContent: Execution context was destroyed, most likely because of a navigation
Call log:
[2m  - waiting for locator(':scope')[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] ERROR in settings section: elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m

[00:28:03] --- SETTINGS_PROFILE ---
[00:28:07] Key restore screen detected — clicking Skip
[00:28:09] SETTINGS_PROFILE: Avatar: true
[00:28:09] SETTINGS_PROFILE: Display name: ""
[00:28:09] SETTINGS_PROFILE: Change avatar button: true
[00:28:09] SETTINGS_PROFILE: User ID visible: true
[00:28:09] SETTINGS_PROFILE: Save button: true
[00:28:09] --- SETTINGS_APPEARANCE ---
[00:28:11] Key restore screen detected — clicking Skip
[00:28:13] SETTINGS_APPEARANCE: Theme options: 4
[00:28:13] SETTINGS_APPEARANCE: Current theme: "System"
[00:28:16] SETTINGS_APPEARANCE: Theme switch works
[00:28:16] --- QUICK_REACTIONS ---
[00:28:18] Key restore screen detected — clicking Skip
[00:28:23] QUICK_REACTIONS: 6 quick emoji buttons found
[00:28:23] QUICK_REACTIONS: PASS
[00:28:24] --- HASHTAG_RENDER ---
[00:28:24] --- AT_ROOM_MENTION ---
[00:28:25] AT_ROOM_MENTION: PASS — @room option visible
[00:28:26] --- REPLY_TRUNCATION ---
[00:28:26] REPLY_TRUNCATION: No reply quotes visible, skipping
[00:28:26] --- DRAFT_PERSIST ---
[00:28:28] Key restore screen detected — clicking Skip
[00:28:33] Key restore screen detected — clicking Skip
[00:28:37] DRAFT_PERSIST: Draft not restored (got "", expected "Draft test 1776040106105")
[00:28:37] --- IMAGE_CAPTION ---
[00:28:37] IMAGE_CAPTION: Attach button present (caption UI added to ImagePreviewDialog)
[00:28:37] --- MENTION_BADGE_LIST ---
[00:28:39] Key restore screen detected — clicking Skip
[00:28:43] MENTION_BADGE_LIST: Mention sent — event $lX3iaUHNrFeUJ6TTeQcR5XDNY5qH4UUEjrDEInAjO80
[00:28:48] Key restore screen detected — clicking Skip
[00:28:53] MENTION_BADGE_LIST: @ icons in room list: 0
[00:28:53] BUG [LOW] MENTION_BADGE_LIST: @ icon not visible (Synapse push rules may not process m.mentions API messages as highlights)
[00:28:53] --- MENTION_SCROLL_ENTER ---
[00:28:54] Key restore screen detected — clicking Skip
[00:29:05] Key restore screen detected — clicking Skip
[00:29:12] MENTION_SCROLL_ENTER: PASS — URL has eventId parameter
[00:29:12] --- MENTION_NAVIGATOR ---
[00:29:17] Key restore screen detected — clicking Skip
[00:29:21] MENTION_NAVIGATOR: Navigator button not visible (highlightCount may be 0)
[00:29:21] --- MENTIONED_BUBBLE ---
[00:29:23] Key restore screen detected — clicking Skip
[00:29:27] MENTIONED_BUBBLE: 3 mentioned message(s) visible
[00:29:27] MENTIONED_BUBBLE: PASS — mention highlight class applied
[00:29:27] --- ROOM_MENTION ---
[00:29:29] Key restore screen detected — clicking Skip
[00:29:33] ROOM_MENTION: @room message sent
[00:29:39] Key restore screen detected — clicking Skip
[00:29:43] ROOM_MENTION: @ icons after @room: 0
[00:29:43] BUG [LOW] ROOM_MENTION: @room mention did not trigger highlight badge
[00:29:43] --- REACTION_STABILITY ---
[00:29:45] Key restore screen detected — clicking Skip
[00:29:48] REACTION_STABILITY: First reaction added
[00:29:51] REACTION_STABILITY: PASS — reaction persists after sync
[00:29:51] --- REACTION_RAPID_CLICKS ---
[00:29:55] REACTION_RAPID_CLICKS: Reactions still present after rapid clicks: false
[00:29:55] --- TIMELINE_NO_JITTER ---
[00:29:57] Key restore screen detected — clicking Skip
[00:30:02] TIMELINE_NO_JITTER: Reply preview set
[00:30:05] TIMELINE_NO_JITTER: PASS — reply preview preserved
[00:30:05] TIMELINE_NO_JITTER: Scroll before=0, after=0
[00:30:08] --- PIN_MESSAGE_LIVE ---
[00:30:08] --- PRIVACY_SETTINGS ---
[00:30:10] Key restore screen detected — clicking Skip
[00:30:13] PRIVACY_SETTINGS: 2 privacy toggles found
[00:30:13] PRIVACY_SETTINGS: PASS
[00:30:13] PRIVACY_SETTINGS: Deactivate button: true
[00:30:13] --- IDLE_LOGOUT_SETTING ---
[00:30:15] Key restore screen detected — clicking Skip
[00:30:18] IDLE_LOGOUT_SETTING: 6 timeout options
[00:30:18] IDLE_LOGOUT_SETTING: PASS
[00:30:18] --- VOICE_BUTTON ---
[00:30:20] Key restore screen detected — clicking Skip
[00:30:23] VOICE_BUTTON: No send button area
[00:30:23] --- SLASH_COMMANDS ---
[00:30:23] --- SEND_QUEUE_DB ---
[00:30:23] SEND_QUEUE_DB: send queue store exists: true
[00:30:23] --- SAVED_MESSAGES_NO_DUP ---
[00:30:25] Key restore screen detected — clicking Skip
[00:30:33] Key restore screen detected — clicking Skip
[00:30:39] SAVED_MESSAGES_NO_DUP: PASS — same room opened twice
[00:30:39] --- ENCRYPTED_RECOVERY_KEY ---
[00:30:39] ENCRYPTED_RECOVERY_KEY: shape=null, encrypted=false
[00:30:39] --- LOGGER_MODULE ---
[00:30:39] LOGGER_MODULE: App loaded OK at http://localhost:5173/rooms/!juPQuWKVwKeanEOnKY%3Alocalhost
[00:30:39] --- TOUCH_TARGETS ---
[00:30:41] Key restore screen detected — clicking Skip
[00:30:44] TOUCH_TARGETS: PASS
[00:30:44] --- SKIP_LINK ---
[00:30:46] Key restore screen detected — clicking Skip
[00:30:49] SKIP_LINK: PASS
[00:30:49] --- CROSS_SIGNING_UI_PRESENT ---
[00:30:51] Key restore screen detected — clicking Skip
[00:30:55] CROSS_SIGNING_UI_PRESENT: Verify button: true
[00:30:55] --- ROOM_LIST_TABS ---
[00:30:57] Key restore screen detected — clicking Skip
[00:31:01] ROOM_LIST_TABS: 4 tab buttons
[00:31:02] ROOM_LIST_TABS: Unread tab clicked
[00:31:05] ROOM_LIST_TABS: PASS
[00:31:05] --- ROOM_NOTIFY_LEVELS ---
[00:31:07] Key restore screen detected — clicking Skip
[00:31:11] ROOM_NOTIFY_LEVELS: PASS — All/Mentions/Mute available
[00:31:11] --- EMOJI_AUTOCOMPLETE ---
[00:31:13] Key restore screen detected — clicking Skip
[00:31:16] EMOJI_AUTOCOMPLETE: PASS — popup with emoji candidates
[00:31:17] --- MULTI_FILE_INPUT ---
[00:31:17] MULTI_FILE_INPUT: PASS — multiple attribute set
[00:31:17] --- LIGHTBOX_NAV ---
[00:31:17] LIGHTBOX_NAV: skipped (requires media setup)
[00:31:17] --- MEMBER_ACTIONS ---
[00:31:19] MEMBER_ACTIONS: 0 action buttons found
[00:31:20] --- ROOM_NAME_EDITABLE ---
[00:31:22] ROOM_NAME_EDITABLE: No room name element
[00:31:22] --- FREQUENT_EMOJI ---
[00:31:22] FREQUENT_EMOJI: localStorage value: present
[00:31:22] --- I18N_CLEANUP ---
[00:31:23] Key restore screen detected — clicking Skip
[00:31:29] I18N_CLEANUP: Settings page loaded OK
[00:31:29] --- HIGH_CONTRAST_CSS ---
[00:31:29] HIGH_CONTRAST_CSS: PASS — @media (prefers-contrast) detected
[00:31:29] --- CALL_BUTTONS_DM ---
[00:31:31] Key restore screen detected — clicking Skip
[00:31:37] CALL_BUTTONS_DM: header buttons: Голосовой звонок | Видеозвонок | Invite user
[00:31:37] CALL_BUTTONS_DM: PASS
[00:31:37] --- INCOMING_CALL_CONTAINER ---
[00:31:39] Key restore screen detected — clicking Skip
[00:31:44] INCOMING_CALL_CONTAINER: PASS — app loaded with global CallContainer
[00:31:44] --- MEMBER_ONLINE ---
[00:31:46] Key restore screen detected — clicking Skip
[00:31:55] MEMBER_ONLINE: 9 avatars in room details
[00:31:55] --- ROOM_AVATAR_EDIT ---
[00:31:58] ROOM_AVATAR_EDIT: Avatar upload label: false
[00:31:58] --- SPACES_CONTEXT ---
[00:31:59] Key restore screen detected — clicking Skip
[00:32:04] SPACES_CONTEXT: No spaces button (no spaces created)
[00:32:04] --- BUNDLE_VISUALIZER ---
[00:32:04] BUNDLE_VISUALIZER: PASS — installed v^7.0.1
[00:32:04] --- CONTRAST_FIX ---
[00:32:06] Key restore screen detected — clicking Skip
[00:32:11] CONTRAST_FIX: --color-text-secondary = #5a627a
[00:32:11] CONTRAST_FIX: PASS — improved to #5a627a
[00:32:11] --- SYNC_PERSISTED ---
[00:32:11] SYNC_PERSISTED: corp-matrix-sync DB exists: true
[00:32:11] SYNC_PERSISTED: PASS
[00:32:11] --- LAZY_CHUNKS ---
[00:32:12] Key restore screen detected — clicking Skip
[00:32:18] LAZY_CHUNKS: Lightbox loaded initially: false
[00:32:18] LAZY_CHUNKS: EmojiPicker loaded initially: false
[00:32:18] --- SWIPE_REPLY ---
[00:32:20] Key restore screen detected — clicking Skip
[00:32:26] SWIPE_REPLY: No message, skipping
[00:32:26] --- THREAD_BACK_BUTTON ---
[00:32:26] --- XSS_SANITIZATION ---
[00:32:26] --- ERROR_BOUNDARY ---
[00:32:26] ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)
[00:32:26] --- CRYPTO_BANNER ---
[00:32:28] Key restore screen detected — clicking Skip
[00:32:32] CRYPTO_BANNER: PASS — no warning banner (crypto is working)
[00:32:32] --- SEND_ERROR_FEEDBACK ---
[00:32:33] Key restore screen detected — clicking Skip
[00:32:38] SEND_ERROR_FEEDBACK: Textarea aria-label="Type a message..."
[00:32:38] SEND_ERROR_FEEDBACK: PASS
[00:32:38] --- TIMELINE_A11Y ---
[00:32:38] TIMELINE_A11Y: role="log" found, aria-live="polite"
[00:32:38] TIMELINE_A11Y: Composer form has role="form"
[00:32:38] TIMELINE_A11Y: PASS
[00:32:38] --- SECURITY_HEADERS ---
[00:32:38] SECURITY_HEADERS: Page loaded OK (CSP not blocking app)
[00:32:38] SECURITY_HEADERS: CSP meta tag: false
[00:32:38] --- ENCRYPTION_SETTINGS ---
[00:32:40] Key restore screen detected — clicking Skip
[00:32:56] ENCRYPTION_SETTINGS: Key backup button: false
[00:32:56] ENCRYPTION_SETTINGS: Has backup-related content: true
[00:32:56] --- DEVICES_SETTINGS ---
[00:32:58] Key restore screen detected — clicking Skip
[00:33:04] DEVICES_SETTINGS: Device elements: 3
[00:33:04] DEVICES_SETTINGS: Current device indicator: true
[00:33:04] DEVICES_SETTINGS: Device IDs found: 1
[00:33:04] --- DEVICE_PROLIFERATION ---
[00:33:04] DEVICE_PROLIFERATION: Total devices for @testuser1:localhost: 3
[00:33:04]   Device: OPUUNVDCJB | name="-" | last_seen=2026-04-13T00:26:00
[00:33:04]   Device: VGJIYJYMIW | name="-" | last_seen=2026-04-13T00:33:04
[00:33:04]   Device: YWIGWWEKKS | name="-" | last_seen=2026-04-13T00:31:53
[00:33:04] --- KEY_BACKUP_STATUS ---
[00:33:04] KEY_BACKUP_STATUS: Backup exists — version=32, algorithm=m.megolm_backup.v1.curve25519-aes-sha2
[00:33:04] --- ENCRYPTED_MESSAGES ---
[00:33:05] Key restore screen detected — clicking Skip
[00:33:12] ENCRYPTED_MESSAGES: No UTD indicators found
[00:33:12] ENCRYPTED_MESSAGES: Encryption badge in header: false
[00:33:12] --- CROSS_SIGNING_UI ---
[00:33:13] Key restore screen detected — clicking Skip
[00:33:31] CROSS_SIGNING_UI: Verify button: true
[00:33:31] CROSS_SIGNING_UI: Cross-signing info: true, Verification info: true
[00:33:31] --- D1_CONTEXT_REACTIVITY ---
[00:33:32] Key restore screen detected — clicking Skip
[00:33:47] Key restore screen detected — clicking Skip
[00:33:53] Key restore screen detected — clicking Skip
[00:33:59] D1_CONTEXT_REACTIVITY: PASS
[00:33:59] --- CREATE_POLL ---
[00:34:01] Key restore screen detected — clicking Skip
[00:34:16] CREATE_POLL: PASS
[00:34:16] --- POLL_VOTE ---
[00:34:18] Key restore screen detected — clicking Skip
[00:34:22] POLL_VOTE: SKIP (no poll from previous test)
[00:34:22] --- READ_RECEIPTS_VISUAL ---
[00:34:30] READ_RECEIPTS_VISUAL: PASS
[00:34:30] --- TYPING_INDICATOR ---
[00:34:39] --- INVITE_ACCEPT_DECLINE ---
[00:34:48] Key restore screen detected — clicking Skip
[00:34:55] INVITE_ACCEPT_DECLINE: PASS
[00:34:55] --- CREATE_SPACE ---
[00:34:57] Key restore screen detected — clicking Skip
[00:35:04] CREATE_SPACE: SKIP (modal is not "create space")
[00:35:04] --- MESSAGE_SEARCH_WIRED ---
[00:35:06] Key restore screen detected — clicking Skip
[00:35:13] MESSAGE_SEARCH_WIRED: PASS — search button opens SearchPanel modal
[00:35:13] --- KEY_RESTORE_METHODS ---
[00:35:13] KEY_RESTORE_METHODS: SKIP (screen not visible, keys already loaded)
[00:35:13] --- NETWORK_RECONNECT ---
[00:35:15] Key restore screen detected — clicking Skip
[00:35:30] NETWORK_RECONNECT: PASS
[00:35:30] --- SW_REGISTERED ---
[00:35:32] Key restore screen detected — clicking Skip
[00:35:37] SW: controller=http://localhost:5173/dev-sw.js?dev-sw, registrations=1
[00:35:37] SW_REGISTERED: PASS
[00:35:37] --- SCROLL_AFTER_SEND ---
[00:35:37] SCROLL_AFTER_SEND: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!UbMotTGhbQiVNxhJEJ:localhost", waiting until "domcontentloaded"[22m

[00:35:37] --- SCROLL_TO_BOTTOM_FAB ---
[00:35:38] SCROLL_FAB: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!UbMotTGhbQiVNxhJEJ:localhost", waiting until "domcontentloaded"[22m

[00:35:38] --- OFFLINE_BANNER ---
[00:35:39] Key restore screen detected — clicking Skip
[00:35:52] OFFLINE_BANNER: banner found with text "⟳Переподключение..."
[00:35:55] OFFLINE_BANNER: PASS �� banner disappeared after reconnect
[00:35:55] --- TYPING_TIMEOUT ---
[00:36:00] Key restore screen detected — clicking Skip
[00:36:04] TYPING_TIMEOUT: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!UbMotTGhbQiVNxhJEJ:localhost", waiting until "domcontentloaded"[22m

[00:36:04] --- FORWARD_COMPLETE ---
[00:36:12] FORWARD_COMPLETE: Search input found in dialog
[00:36:16] FORWARD_COMPLETE: PASS — message forwarded, dialog closed
[00:36:16] --- VOICE_RECORD_FLOW ---
[00:36:21] VOICE_RECORD_FLOW: Recorder UI appeared
[00:36:24] VOICE_RECORD_FLOW: PASS — recorder UI shown and dismissed
[00:36:24] --- CONTEXT_MENU_ALL_ACTIONS ---
[00:36:27] CTX_MENU_ALL_ACTIONS: Pin action not found in menu
[00:36:33] CTX_MENU_ALL_ACTIONS: Copy link — PASS (clicked)
[00:36:39] CTX_MENU_ALL_ACTIONS: Select — selection UI appeared
[00:36:40] CTX_MENU_ALL_ACTIONS: Summary — 2 actions found, 2 tested
[00:36:40] --- MOBILE_LONG_PRESS ---
[00:36:42] MOBILE_LONG_PRESS: ERROR touchscreen.tap: hasTouch must be enabled on the browser context before using the touchscreen.
[00:36:42] --- REPLY_QUOTE ---
[00:36:43] REPLY_QUOTE: SKIP — no message body element found
[00:36:43] --- FORWARD_E2E_WARNING ---
[00:36:43] FORWARD_E2E_WARNING: ERROR page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
[2m  - navigating to "http://localhost:5173!XFaArVAXKOLrhktSUh:localhost", waiting until "domcontentloaded"[22m

[00:36:43] --- STRESS_MESSAGES ---
[00:36:50] Key restore screen detected — clicking Skip
[00:37:03] STRESS_MESSAGES: new console errors=2
[00:37:03] STRESS_MESSAGES: PASS
[00:37:03] --- SSO_BUTTON_VISIBILITY ---
[00:37:07] SSO_BUTTON_VISIBILITY: PASS — no SSO button (server does not support SSO)
[00:37:07] --- SSO_CALLBACK_ROUTE ---
[00:37:11] SSO_CALLBACK_ROUTE: PASS — route exists and handles missing loginToken
[00:37:11] --- GROUP_CALL_BUTTON ---
[00:37:11] GROUP_CALL_BUTTON: PASS — code integration verified (import=true, button=true, join=true)
[00:37:11] GROUP_CALL_BUTTON: GroupCallView.tsx exists=true
[00:37:11] --- GROUP_CALL_NOT_IN_DM ---
[00:37:12] Key restore screen detected — clicking Skip
[00:37:18] GROUP_CALL_NOT_IN_DM: PASS — no group call button in DM
[00:37:18] --- KEY_IMPORT_BUTTON ---
[00:37:19] Key restore screen detected — clicking Skip
[00:37:24] KEY_IMPORT_BUTTON: PASS — import button visible
[00:37:24] --- KEY_IMPORT_DIALOG ---
[00:37:26] Key restore screen detected — clicking Skip
[00:37:34] KEY_IMPORT_DIALOG: PASS — modal open, file=true, password=true
[00:37:34] --- SCROLL_POSITION ---
[00:37:36] Key restore screen detected — clicking Skip
[00:37:43] Key restore screen detected — clicking Skip
[00:37:50] Key restore screen detected — clicking Skip
[00:37:56] SCROLL_POSITION: before=0, after=0
[00:37:56] SCROLL_POSITION: Position not preserved (Virtuoso restore may need time)
[00:37:56] --- IOS_SAFE_AREA ---
[00:37:56] IOS_SAFE_AREA: PASS — viewport-fit=cover set, composer padding=true
[00:37:56] --- CONNECTION_BANNER ---
[00:37:58] Key restore screen detected — clicking Skip
[00:38:03] CONNECTION_BANNER: PASS — no banner when connected (correct)
[00:38:03] --- DOCKERFILE ---
[00:38:03] DOCKERFILE: PASS — exists, multistage=true, nginx=true
[00:38:03] --- MESSAGE_BUBBLE_SPLIT ---
[00:38:03] MESSAGE_BUBBLE_SPLIT: PASS — 627 lines, subcomponents exist
[00:38:03] MESSAGE_BUBBLE_SPLIT: imports MessageContent=true, ReactionBar=true
[00:38:03] --- ROOM_LIST_CACHE ---
[00:38:03] ROOM_LIST_CACHE: PASS — entry cache + mention cache + throttle present
[00:38:03] --- TOKEN_STORAGE ---
[00:38:03] TOKEN_STORAGE: PASS — using IndexedDB for session storage
[00:38:03] --- MENTION_FALLBACK_PERF ---
[00:38:03] MENTION_FALLBACK_PERF: PASS — scan limited + cooldown present
[00:38:03] --- MESSAGE_RENDER_SPLIT ---
[00:38:05] Key restore screen detected — clicking Skip
[00:38:11] MESSAGE_RENDER_SPLIT: PASS — 10 messages, 0 with content, 0 reaction bars
[00:38:11] --- ROOM_LIST_PERF ---
[00:38:13] Key restore screen detected — clicking Skip
[00:38:16] ROOM_LIST_PERF: 1 rooms loaded in 5274ms
[00:38:16] ROOM_LIST_PERF: PASS — loaded in 5274ms
[00:38:16] --- RESPONSIVE_MOBILE ---
[00:38:23] Key restore screen detected — clicking Skip
[00:38:31] RESPONSIVE_mobile: Back button in room: false
[00:38:31] RESPONSIVE_mobile: Composer visible: true
[00:38:33] Key restore screen detected — clicking Skip
[00:38:37] --- RESPONSIVE_TABLET ---
[00:38:43] Key restore screen detected — clicking Skip
[00:38:51] RESPONSIVE_tablet: Back button in room: false
[00:38:51] RESPONSIVE_tablet: Composer visible: true
[00:38:53] Key restore screen detected — clicking Skip
[00:38:57] ═══ MULTI-USER TEST ═══
[00:39:03] Key restore screen detected — clicking Skip
[00:39:07] MULTI_USER: User2 logged in
[00:39:15] Key restore screen detected — clicking Skip
[00:39:21] --- SETTINGS_LOGOUT ---
[00:39:23] Key restore screen detected — clicking Skip
[00:39:29] SETTINGS_LOGOUT: Modal text: "Вы уверены, что хотите выйти из аккаунта?"
[00:39:30] SETTINGS_LOGOUT: Cancel closes modal: true
[00:39:36] SETTINGS_LOGOUT: PASS — redirected to /login
[00:39:36] ═══ FEDERATION: Starting Docker containers ═══
[00:39:37] FEDERATION: Setup failed: Command failed: docker compose up -d
 Network federation-test_default  Creating
 Network federation-test_default  Created
 Container synapse2  Creating
 Container synapse1  Creating
 Container synapse1  Created
 Container synapse2  Created
 Container synapse2  Starting
 Container synapse1  Starting
 Container synapse2  Started
Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint synapse1 (ee63fdc9328f11c375a0771daae443440d8ab3325deccf317242824a73b7affc): Bind for 0.0.0.0:8008 failed: port is already allocated

[00:39:37] --- AUTH_EMPTY ---
[00:39:43] AUTH_EMPTY: PASS — validation works
[00:39:43] --- AUTH_WRONG_CREDS ---
[00:39:53] AUTH_WRONG_CREDS: PASS — error: "MatrixError: [403] Invalid username or password (http://127.0.0.1:8008/_matrix/client/v3/login)"
[00:39:53] --- REGISTER_PAGE ---
[00:39:56] Register page has 4 input fields
[00:39:56] REGISTER_PAGE: Login link present
[00:39:56] --- REGISTER_MISMATCH ---
[00:40:03] REGISTER_MISMATCH: PASS — error shown for mismatch
[00:40:03] --- CONSOLE_ERRORS ---
[00:40:03] Console errors: 2 unique (135 filtered as harmless)
[00:40:03] BUG [HIGH] CONSOLE_ERRORS: React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from a parent component, remove it from the DOM elemen
[00:40:03] BUG [HIGH] CONSOLE_ERRORS: Failed to process outgoing request 0: M_UNKNOWN: MatrixError: [400] One time key signed_curve25519:AAAAAAAAAA0 already exists. Old key: {"key":"WG0/pDHOjV1g2oCrlfDzwBK+ZoKuciU0Ux6FhBdrFx0","signatures":{"@testuser1:localhost":{"ed25519:HMBOBJVEHI":"S
[00:40:03] --- NETWORK_ERRORS ---
[00:40:03] NETWORK_ERRORS: None
[00:40:03] ═══ POST-RUN CLEANUP ═══
[00:40:03] Cleanup: purging stale test rooms from previous runs...
[00:40:05]   No stale test rooms found
```
