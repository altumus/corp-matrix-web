# Bug Report — Corp Matrix Web

**Date:** 2026-04-11
**App URL:** http://localhost:5173
**Homeserver:** http://127.0.0.1:8008
**Total bugs:** 2

## Summary
| Severity | Count |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 1 |
| 🟢 LOW | 1 |

## Bugs
| # | Severity | Scenario | Description | Steps | Screenshot |
|---|---|---|---|---|---|
| 1 | 🟡 MEDIUM | MENTION_BADGE_LIST | @ icon not visible in room list when user is mentioned | 1. Send mention to user from another account 2. Open room list 3. @ icon should appear next to the room | [screenshot](screenshots/052-mention-badge-list.png) |
| 2 | 🟢 LOW | ROOM_MENTION | @room mention did not trigger highlight badge |  | - |

## Console Errors
- `2026-04-11T00:25:20.783Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:21.565Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:21.656Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:21.667Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:26.436Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:26.730Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:26.750Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:28.272Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:28.535Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:28.543Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:35.029Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:35.307Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:35.316Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:37.617Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:37.903Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:37.910Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:39.357Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:39.681Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:39.693Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:53.102Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:53.463Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:53.470Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:54.897Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/room-state-CbAq0nnC.js?v=46e07b66:14746:11
    at Generator.throw (<anonymous>)

- `2026-04-11T00:25:55.229Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-11T00:25:55.235Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)

## Network Errors
- `2026-04-11T00:25:20.783Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-11T00:25:21.565Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-11T00:25:21.656Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-11T00:25:21.667Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-11T00:25:26.730Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:26.750Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:28.535Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:28.543Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:35.307Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:35.316Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:37.903Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:37.910Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:39.681Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:39.693Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:53.463Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:53.470Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:55.229Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:55.235Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:25:59.243Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:25:59.250Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:26:04.445Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:26:04.452Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:26:10.668Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12
- `2026-04-11T00:26:10.675Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=12
- `2026-04-11T00:26:12.462Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=12

## Test Log
```
[00:25:00] ═══ PHASE 0: SETUP ═══
[00:25:00] Homeserver OK — versions: v1.11, v1.12
[00:25:00]   User @testuser1 — logged in (existing)
[00:25:02]   Cleaned up 5/5 old device(s) for testuser1
[00:25:02]   Deleted old key backup v11 for testuser1
[00:25:02]   User @testuser2 — logged in (existing)
[00:25:02]   Cleaned up 2/2 old device(s) for testuser2
[00:25:02]   Deleted old key backup v10 for testuser2
[00:25:03] Creating test rooms...
[00:25:03]   Room "QA General" — !dUmKEjjZZHHpPCezOi:localhost
[00:25:04]   DM room — !PGfwPGWELTWdzRApUb:localhost
[00:25:04]   Room "QA Empty Room" — !BnFfDPZCNIdExXOIfv:localhost
[00:25:05]   Room "QA Encrypted" — !WlgLrITHklAcEcknLj:localhost (E2E enabled)
[00:25:06]   Room "QA Media" — !ObtUprzJxDmwxHXJCO:localhost
[00:25:06] Populating "QA General" with messages...
[00:25:13]   Sent 12 messages
[00:25:13] Populating DM with messages...
[00:25:14]   Sent 3 DM messages
[00:25:14] Display names set
[00:25:14] ═══ SETUP COMPLETE ═══
[00:25:14]   Users: @testuser1:localhost, @testuser2:localhost
[00:25:14]   Rooms: general=!dUmKEjjZZHHpPCezOi:localhost, dm=!PGfwPGWELTWdzRApUb:localhost, empty=!BnFfDPZCNIdExXOIfv:localhost, media=!ObtUprzJxDmwxHXJCO:localhost
[00:25:15] ═══ PHASE 1: DISCOVERY ═══
[00:25:18] Start URL: http://localhost:5173/login
[00:25:18] Interactive elements on start page: 5
[00:25:18] --- AUTH_LOGIN ---
[00:25:24] AUTH_LOGIN: PASS
[00:25:24] ═══ POST-AUTH DISCOVERY ═══
[00:25:26] Rooms visible: 11
[00:25:26] Search input: true
[00:25:26] Create room btn: true
[00:25:26] Settings btn: true
[00:25:26] Saved messages btn: true
[00:25:26] Room list header: "Chatsv1.0.0"
[00:25:26] --- ROOM_LIST_DISPLAY ---
[00:25:28] ROOM_LIST_DISPLAY: Only Saved Messages visible (Virtuoso viewport), skipping avatar check
[00:25:28] Unread badges visible: 0
[00:25:28] Status icons (encrypted/muted/pinned): 0
[00:25:28] --- ROOM_SEARCH ---
[00:25:32] ROOM_SEARCH: dropdown=true, results=16
[00:25:35] ROOM_SEARCH: PASS
[00:25:35] --- ROOM_LIST_CONTEXT_MENU ---
[00:25:36] ROOM_LIST_CONTEXT_MENU: Actions: Saved Messages | Mute notifications | Mark as unread | Pin | Low priority | Add to space | Archive | Leave
[00:25:37] --- ROOM_SWITCH ---
[00:25:54] Room view: header=true, composer=true, timeline=true
[00:25:54] ROOM_SWITCH: No selected state indicator on room item
[00:25:58] ROOM_SWITCH: Successfully switched rooms (http://localhost:5173/rooms/!dUmKEjjZZHHpPCezOi%3Alocalhost -> http://localhost:5173/rooms/!YgpiRahNdAztOUzYZw%3Alocalhost)
[00:25:58] --- ROOM_CREATE ---
[00:26:01] ROOM_CREATE: Tabs found: 3
[00:26:01] ROOM_CREATE: Input fields: 3
[00:26:02] ROOM_CREATE (DM tab): Visible inputs: 3
[00:26:04] --- ROOM_HEADER ---
[00:26:06] ROOM_HEADER: name="QA Empty Room", avatar=true, invite=true, info=true
[00:26:07] ROOM_HEADER: Details panel opened: true
[00:26:09] ROOM_HEADER: Invite dialog opened: true
[00:26:10] --- EMPTY_ROOM ---
[00:26:12] EMPTY_ROOM: empty indicator=false, messages=2
[00:26:12] --- DM_ROOM ---
[00:26:13] DM_ROOM: Header subtitle: "offline"
[00:26:13] DM_ROOM: Online indicator: false
[00:26:13] DM_ROOM: Messages visible: 14
[00:26:13] --- TIMELINE_SCROLL ---
[00:26:15] TIMELINE_SCROLL: Initial messages: 14
[00:26:15] TIMELINE_SCROLL: Typing indicator area: false
[00:26:15] TIMELINE_SCROLL: Pinned message bar: false
[00:26:15] --- CHAT_SEND_MESSAGE ---
[00:26:17] CHAT_SEND_MESSAGE: PASS, outgoing bubble: true
[00:26:17] --- CHAT_SEND_ENTER ---
[00:26:19] CHAT_SEND_ENTER: PASS
[00:26:19] --- CHAT_SHIFT_ENTER ---
[00:26:20] CHAT_SHIFT_ENTER: PASS — value has newline: true
[00:26:21] --- CHAT_SEND_EMPTY ---
[00:26:21] CHAT_SEND_EMPTY: PASS — send disabled for empty
[00:26:22] --- CHAT_LONG_MESSAGE ---
[00:26:22] CHAT_LONG_MESSAGE: Textarea height after long text: 200px
[00:26:26] CHAT_LONG_MESSAGE: Sent
[00:26:26] --- CHAT_SPECIAL_CHARS ---
[00:26:28] CHAT_SPECIAL_CHARS: PASS — no XSS
[00:26:28] --- ATTACH_MENU ---
[00:26:29] ATTACH_MENU: Items: Start poll | Send image | Send video | Send file
[00:26:30] ATTACH_MENU: File input accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
[00:26:30] --- MESSAGE_BUBBLE ---
[00:26:30] MESSAGE_BUBBLE: 18 messages visible
[00:26:30] MESSAGE_BUBBLE: bubble=true, time=true, content=true
[00:26:30] MESSAGE_BUBBLE: Date separators: 0
[00:26:30] MESSAGE_BUBBLE: Messages with reactions: 0
[00:26:30] MESSAGE_BUBBLE: Thread badges: 0
[00:26:30] MESSAGE_BUBBLE: Edited messages: 0
[00:26:30] MESSAGE_BUBBLE: Read receipts: 12
[00:26:30] --- MSG_CONTEXT_MENU ---
[00:26:31] MSG_CONTEXT_MENU: Actions: Reply | Edit | Copy text | Copy link to message | Forward | Thread | Select | React | Delete (DANGER)
[00:26:31] MSG_CONTEXT_MENU: Receipts row: true
[00:26:32] MSG_CONTEXT_MENU: Closes on Escape
[00:26:32] --- MSG_REPLY ---
[00:26:34] MSG_REPLY: Reply preview shown, cancel btn: true
[00:26:36] MSG_REPLY: Reply quote visible: false
[00:26:36] --- MSG_EDIT ---
[00:26:38] MSG_EDIT: Edit mode activated with preview
[00:26:38] MSG_EDIT: Textarea pre-filled: "..."
[00:26:40] MSG_EDIT: Edited badge visible: false
[00:26:40] --- MSG_EDIT_CANCEL ---
[00:26:43] MSG_EDIT_CANCEL: PASS — Escape cancels edit
[00:26:43] --- MSG_FORWARD ---
[00:26:45] MSG_FORWARD: Search: true, rooms: 82
[00:26:46] --- MSG_SELECT ---
[00:26:48] MSG_SELECT: Selection count: "1 selected"
[00:26:48] MSG_SELECT: Selection action buttons: 4
[00:26:48] MSG_SELECT: Checkboxes visible: 6
[00:26:48] MSG_SELECT: After selecting 2nd: "2 selected"
[00:26:49] MSG_SELECT: Selection cancelled: true
[00:26:49] --- MSG_COPY ---
[00:26:50] MSG_COPY: Copy action clicked
[00:26:51] --- MSG_THREAD ---
[00:26:53] MSG_THREAD: Thread panel opened
[00:26:54] --- MSG_REACT ---
[00:26:57] MSG_REACT: Emoji picker opened
[00:26:57] --- MSG_DELETE ---
[00:27:03] MSG_DELETE: Redacted message visible: false
[00:27:07] Key restore screen detected — clicking Skip
[00:27:11] --- SETTINGS_NAV ---
[00:27:13] Key restore screen detected — clicking Skip
[00:27:15] SETTINGS_NAV: Sections: Profile, Appearance, Devices, Encryption, Language, Notifications
[00:27:17] SETTINGS_NAV: Visited profile
[00:27:19] SETTINGS_NAV: Visited appearance
[00:27:20] SETTINGS_NAV: Visited devices
[00:27:22] SETTINGS_NAV: Visited encryption
[00:27:24] SETTINGS_NAV: Visited language
[00:27:25] SETTINGS_NAV: Visited notifications
[00:27:25] --- SETTINGS_PROFILE ---
[00:27:27] Key restore screen detected — clicking Skip
[00:27:29] SETTINGS_PROFILE: Avatar: true
[00:27:29] SETTINGS_PROFILE: Display name: ""
[00:27:29] SETTINGS_PROFILE: Change avatar button: true
[00:27:29] SETTINGS_PROFILE: User ID visible: true
[00:27:29] SETTINGS_PROFILE: Save button: true
[00:27:29] --- SETTINGS_APPEARANCE ---
[00:27:31] Key restore screen detected — clicking Skip
[00:27:33] SETTINGS_APPEARANCE: Theme options: 4
[00:27:33] SETTINGS_APPEARANCE: Current theme: "System"
[00:27:36] SETTINGS_APPEARANCE: Theme switch works
[00:27:36] --- QUICK_REACTIONS ---
[00:27:37] Key restore screen detected — clicking Skip
[00:27:40] QUICK_REACTIONS: No messages, skipping
[00:27:40] --- HASHTAG_RENDER ---
[00:27:43] HASHTAG_RENDER: PASS — 2 hashtags styled
[00:27:43] --- AT_ROOM_MENTION ---
[00:27:45] AT_ROOM_MENTION: PASS — @room option visible
[00:27:45] --- REPLY_TRUNCATION ---
[00:27:45] REPLY_TRUNCATION: No reply quotes visible, skipping
[00:27:45] --- DRAFT_PERSIST ---
[00:27:47] Key restore screen detected — clicking Skip
[00:27:52] Key restore screen detected — clicking Skip
[00:27:56] DRAFT_PERSIST: Draft not restored (got "", expected "Draft test 1775867265334")
[00:27:56] --- IMAGE_CAPTION ---
[00:27:56] IMAGE_CAPTION: Attach button present (caption UI added to ImagePreviewDialog)
[00:27:56] --- MENTION_BADGE_LIST ---
[00:27:58] Key restore screen detected — clicking Skip
[00:28:02] MENTION_BADGE_LIST: Mention sent — event $I4Czlr7pDMFcr6bsV9s5EJhIiMPniJsQiS-An2y_LzA
[00:28:07] Key restore screen detected — clicking Skip
[00:28:12] MENTION_BADGE_LIST: @ icons in room list: 0
[00:28:12] BUG [MEDIUM] MENTION_BADGE_LIST: @ icon not visible in room list when user is mentioned
[00:28:12] --- MENTION_SCROLL_ENTER ---
[00:28:13] Key restore screen detected — clicking Skip
[00:28:23] Key restore screen detected — clicking Skip
[00:28:27] MENTION_SCROLL_ENTER: No room with @ icon found
[00:28:27] --- MENTION_NAVIGATOR ---
[00:28:32] Key restore screen detected — clicking Skip
[00:28:36] MENTION_NAVIGATOR: PASS — navigator button visible
[00:28:38] MENTION_NAVIGATOR: Click handled
[00:28:38] --- MENTIONED_BUBBLE ---
[00:28:40] Key restore screen detected — clicking Skip
[00:28:44] MENTIONED_BUBBLE: 3 mentioned message(s) visible
[00:28:44] MENTIONED_BUBBLE: PASS — mention highlight class applied
[00:28:44] --- ROOM_MENTION ---
[00:28:46] Key restore screen detected — clicking Skip
[00:28:50] ROOM_MENTION: @room message sent
[00:28:55] Key restore screen detected — clicking Skip
[00:29:00] ROOM_MENTION: @ icons after @room: 0
[00:29:00] BUG [LOW] ROOM_MENTION: @room mention did not trigger highlight badge
[00:29:00] --- REACTION_STABILITY ---
[00:29:01] Key restore screen detected — clicking Skip
[00:29:04] REACTION_STABILITY: No messages, skipping
[00:29:04] --- REACTION_RAPID_CLICKS ---
[00:29:04] REACTION_RAPID_CLICKS: No existing reactions, skipping
[00:29:04] --- TIMELINE_NO_JITTER ---
[00:29:06] TIMELINE_NO_JITTER: Reply preview set
[00:29:09] TIMELINE_NO_JITTER: PASS — reply preview preserved
[00:29:09] TIMELINE_NO_JITTER: Scroll before=0, after=0
[00:29:09] --- PIN_MESSAGE_LIVE ---
[00:29:12] PIN_MESSAGE_LIVE: Could not enter selection mode
[00:29:12] --- XSS_SANITIZATION ---
[00:29:19] XSS_SANITIZATION: PASS — all payloads sanitized
[00:29:19] --- ERROR_BOUNDARY ---
[00:29:20] ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)
[00:29:20] --- CRYPTO_BANNER ---
[00:29:21] Key restore screen detected — clicking Skip
[00:29:23] CRYPTO_BANNER: PASS — no warning banner (crypto is working)
[00:29:23] --- SEND_ERROR_FEEDBACK ---
[00:29:25] Key restore screen detected — clicking Skip
[00:29:28] SEND_ERROR_FEEDBACK: Send button aria-label="Send"
[00:29:28] SEND_ERROR_FEEDBACK: Textarea aria-label="Type a message..."
[00:29:28] SEND_ERROR_FEEDBACK: PASS
[00:29:28] --- TIMELINE_A11Y ---
[00:29:28] TIMELINE_A11Y: role="log" found, aria-live="polite"
[00:29:28] TIMELINE_A11Y: Composer form has role="form"
[00:29:28] TIMELINE_A11Y: PASS
[00:29:28] --- SECURITY_HEADERS ---
[00:29:28] SECURITY_HEADERS: Page loaded OK (CSP not blocking app)
[00:29:28] SECURITY_HEADERS: CSP meta tag: false
[00:29:28] --- ENCRYPTION_SETTINGS ---
[00:29:29] Key restore screen detected — clicking Skip
[00:29:44] ENCRYPTION_SETTINGS: Key backup button: false
[00:29:44] ENCRYPTION_SETTINGS: Has backup-related content: true
[00:29:44] --- DEVICES_SETTINGS ---
[00:29:45] Key restore screen detected — clicking Skip
[00:29:50] DEVICES_SETTINGS: Device elements: 3
[00:29:50] DEVICES_SETTINGS: Current device indicator: true
[00:29:50] DEVICES_SETTINGS: Device IDs found: 1
[00:29:50] --- DEVICE_PROLIFERATION ---
[00:29:50] DEVICE_PROLIFERATION: Total devices for @testuser1:localhost: 3
[00:29:50]   Device: GLDBRLTJCE | name="-" | last_seen=2026-04-11T00:29:06
[00:29:50]   Device: QLZGHKQBPY | name="-" | last_seen=2026-04-11T00:25:20
[00:29:50]   Device: XPSZBVWNKZ | name="-" | last_seen=2026-04-11T00:29:50
[00:29:50] --- KEY_BACKUP_STATUS ---
[00:29:50] KEY_BACKUP_STATUS: Backup exists — version=12, algorithm=m.megolm_backup.v1.curve25519-aes-sha2
[00:29:50] --- ENCRYPTED_MESSAGES ---
[00:29:51] Key restore screen detected — clicking Skip
[00:29:56] ENCRYPTED_MESSAGES: No UTD indicators found
[00:29:56] ENCRYPTED_MESSAGES: Encryption badge in header: false
[00:29:56] --- CROSS_SIGNING_UI ---
[00:29:57] Key restore screen detected — clicking Skip
[00:30:13] CROSS_SIGNING_UI: Verify button: false
[00:30:13] CROSS_SIGNING_UI: Cross-signing info: false, Verification info: false
[00:30:13] --- RESPONSIVE_MOBILE ---
[00:30:18] Key restore screen detected — clicking Skip
[00:30:24] RESPONSIVE_mobile: Back button in room: false
[00:30:24] RESPONSIVE_mobile: Composer visible: true
[00:30:25] Key restore screen detected — clicking Skip
[00:30:28] --- RESPONSIVE_TABLET ---
[00:30:33] Key restore screen detected — clicking Skip
[00:30:38] RESPONSIVE_tablet: Back button in room: false
[00:30:38] RESPONSIVE_tablet: Composer visible: true
[00:30:40] Key restore screen detected — clicking Skip
[00:30:42] ═══ MULTI-USER TEST ═══
[00:30:50] MULTI_USER: User2 logged in
[00:30:56] Key restore screen detected — clicking Skip
[00:31:00] --- SETTINGS_LOGOUT ---
[00:31:02] Key restore screen detected — clicking Skip
[00:31:05] SETTINGS_LOGOUT: Modal text: "Вы уверены, что хотите выйти из аккаунта?"
[00:31:06] SETTINGS_LOGOUT: Cancel closes modal: true
[00:31:11] SETTINGS_LOGOUT: PASS — redirected to /login
[00:31:11] --- AUTH_EMPTY ---
[00:31:14] AUTH_EMPTY: PASS — validation works
[00:31:14] --- AUTH_WRONG_CREDS ---
[00:31:21] AUTH_WRONG_CREDS: PASS — error: "MatrixError: [403] Invalid username or password (http://127.0.0.1:8008/_matrix/client/v3/login)"
[00:31:21] --- REGISTER_PAGE ---
[00:31:23] Register page has 4 input fields
[00:31:23] REGISTER_PAGE: Login link present
[00:31:23] --- REGISTER_MISMATCH ---
[00:31:27] REGISTER_MISMATCH: PASS — error shown for mismatch
[00:31:27] --- CONSOLE_ERRORS ---
[00:31:27] CONSOLE_ERRORS: None (85 filtered as harmless)
[00:31:27] --- NETWORK_ERRORS ---
[00:31:27] NETWORK_ERRORS: None
```
