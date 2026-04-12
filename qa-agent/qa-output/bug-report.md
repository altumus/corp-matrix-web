# Bug Report — Corp Matrix Web

**Date:** 2026-04-12
**App URL:** http://localhost:5173
**Homeserver:** http://127.0.0.1:8008
**Total bugs:** 1

## Summary
| Severity | Count |
|---|---|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 0 |
| 🟢 LOW | 1 |

## Bugs
| # | Severity | Scenario | Description | Steps | Screenshot |
|---|---|---|---|---|---|
| 1 | 🟢 LOW | MENTION_SCROLL_ENTER | URL does not contain eventId after clicking mentioned room. URL: http://localhost:5173/rooms/!JfgIWTMAouPIjMAzPb%3Alocalhost |  | [screenshot](screenshots/048-mention-scroll-enter.png) |

## Console Errors
- `2026-04-12T19:00:15.471Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:16.293Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:16.301Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:16.335Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:22.108Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:22.460Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:22.492Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:25.291Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:25.598Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:25.627Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:35.040Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:35.362Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:35.390Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:42.142Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:42.450Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:42.476Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:43.901Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:44.208Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:44.242Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:57.647Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:00:57.964Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:58.010Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:00:59.723Z` [main] sync /sync error %s ConnectionError: fetch failed: Failed to fetch
    at http://localhost:5173/node_modules/.vite/deps/callEventHandler-DrfKKQL1.js?v=c2a12486:15807:11
    at Generator.throw (<anonym
- `2026-04-12T19:01:00.041Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)
- `2026-04-12T19:01:00.061Z` [main] Failed to load resource: the server responded with a status of 404 (Not Found)

## Network Errors
- `2026-04-12T19:00:15.471Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T19:00:16.293Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T19:00:16.301Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T19:00:16.335Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/version
- `2026-04-12T19:00:22.460Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:22.492Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:00:25.598Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:25.627Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:00:35.362Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:35.390Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:00:42.450Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:42.476Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:00:44.208Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:44.242Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:00:57.964Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:00:58.010Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:01:00.041Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:01:00.061Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:01:11.925Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:01:11.950Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:01:25.794Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:01:25.834Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:01:31.342Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!ShrlCNPMWIcGNnMjZP%3Alocalhost/fYaRWXS4zjumln%2FEjke5IRshhv2e3ObSYfw6HYWQvqA?version=24
- `2026-04-12T19:01:31.377Z` [main] HTTP 404 — http://127.0.0.1:8008/_matrix/client/v3/room_keys/keys/!eVEmrKJFNIVhpsCPtU%3Alocalhost/%2BfOa02ms6TSikTQBuuYt%2B6%2F48JZzx5ekzFePvjR7zuU?version=24
- `2026-04-12T19:01:37.182Z` [main] HTTP 400 — http://127.0.0.1:8008/_matrix/client/v3/rooms/!JfgIWTMAouPIjMAzPb%3Alocalhost/receipt/m.read/~!JfgIWTMAouPIjMAzPb%3Alocalhost%3Am1776020497085.0

## Test Log
```
[18:59:49] ═══ PHASE 0: SETUP ═══
[18:59:49] Homeserver OK — versions: v1.11, v1.12
[18:59:50]   User @testuser1 — logged in (existing)
[18:59:52]   Cleaned up 6/6 old device(s) for testuser1
[18:59:52]   Deleted old key backup v23 for testuser1
[18:59:52]   User @testuser2 — logged in (existing)
[18:59:53]   Cleaned up 4/4 old device(s) for testuser2
[18:59:53]   Deleted old key backup v19 for testuser2
[18:59:53] Cleanup: purging stale test rooms from previous runs...
[18:59:53]   No stale test rooms found
[18:59:53] Creating test rooms...
[18:59:54]   Room "QA General" — !JfgIWTMAouPIjMAzPb:localhost
[18:59:55]   DM room — !HrMVlHIrskelCKhpTu:localhost
[18:59:55]   Room "QA Empty Room" — !ksDCsAwLROULxYbJfn:localhost
[18:59:56]   Room "QA Encrypted" — !GDnhKybEWlSrOUjWMB:localhost (E2E enabled)
[18:59:57]   Room "QA Media" — !oitqQOmJFpDSBxvTAs:localhost
[18:59:57] Populating "QA General" with messages...
[19:00:04]   Sent 12 messages
[19:00:04]   Poll created — $cT60renMTLKnsjw-Qp8tbQfbJNXHHSGJTdfvkFbbPgY
[19:00:04] Populating DM with messages...
[19:00:05]   Sent 3 DM messages
[19:00:05] Display names set
[19:00:05] ═══ SETUP COMPLETE ═══
[19:00:05]   Users: @testuser1:localhost, @testuser2:localhost
[19:00:05]   Rooms: general=!JfgIWTMAouPIjMAzPb:localhost, dm=!HrMVlHIrskelCKhpTu:localhost, empty=!ksDCsAwLROULxYbJfn:localhost, media=!oitqQOmJFpDSBxvTAs:localhost
[19:00:06] ═══ PHASE 1: DISCOVERY ═══
[19:00:10] Start URL: http://localhost:5173/login
[19:00:10] Interactive elements on start page: 6
[19:00:10] --- AUTH_LOGIN ---
[19:00:20] AUTH_LOGIN: PASS
[19:00:20] ═══ POST-AUTH DISCOVERY ═══
[19:00:22] Rooms visible: 10
[19:00:22] Search input: true
[19:00:22] Create room btn: true
[19:00:22] Settings btn: true
[19:00:22] Saved messages btn: true
[19:00:22] Room list header: "Chatsv1.0.0"
[19:00:22] --- ROOM_LIST_DISPLAY ---
[19:00:25] ROOM_LIST_DISPLAY: Only Saved Messages visible (Virtuoso viewport), skipping avatar check
[19:00:25] Unread badges visible: 1
[19:00:25] Status icons (encrypted/muted/pinned): 1
[19:00:25] --- ROOM_SEARCH ---
[19:00:31] ROOM_SEARCH: dropdown=true, results=16
[19:00:35] ROOM_SEARCH: PASS
[19:00:35] --- ROOM_LIST_CONTEXT_MENU ---
[19:00:41] ROOM_LIST_CONTEXT_MENU: Actions: Saved Messages | Все сообщения | Только упоминания | Mute notifications | Mark as unread | Pin | Low priority | Add to space | Archive | Leave
[19:00:42] --- ROOM_SWITCH ---
[19:00:59] Room view: header=true, composer=true, timeline=true
[19:00:59] --- ROOM_CREATE ---
[19:01:06] ROOM_CREATE: Tabs found: 3
[19:01:06] ROOM_CREATE: Input fields: 3
[19:01:08] ROOM_CREATE (DM tab): Visible inputs: 3
[19:01:11] --- ROOM_HEADER ---
[19:01:17] ROOM_HEADER: name="QA Empty Room", avatar=true, invite=true, info=true
[19:01:22] ROOM_HEADER: Details panel opened: true
[19:01:24] ROOM_HEADER: Invite dialog opened: true
[19:01:25] --- EMPTY_ROOM ---
[19:01:28] EMPTY_ROOM: empty indicator=false, messages=0
[19:01:28] --- DM_ROOM ---
[19:01:30] DM_ROOM: Header subtitle: "online"
[19:01:30] DM_ROOM: Online indicator: false
[19:01:31] DM_ROOM: Messages visible: 13
[19:01:31] --- TIMELINE_SCROLL ---
[19:01:33] TIMELINE_SCROLL: Initial messages: 0
[19:01:33] TIMELINE_SCROLL: Typing indicator area: false
[19:01:33] TIMELINE_SCROLL: Pinned message bar: false
[19:01:33] --- CHAT_SEND_MESSAGE ---
[19:01:48] CHAT_SEND_MESSAGE: Message sent (textarea cleared) but not yet visible — likely E2E encryption delay
[19:01:48] --- CHAT_SEND_ENTER ---
[19:01:56] CHAT_SEND_ENTER: PASS — textarea cleared (message sent, E2E delay)
[19:01:56] --- CHAT_SHIFT_ENTER ---
[19:01:58] CHAT_SHIFT_ENTER: PASS — value has newline: true
[19:01:58] --- CHAT_SEND_EMPTY ---
[19:01:58] --- CHAT_LONG_MESSAGE ---
[19:01:58] --- CHAT_SPECIAL_CHARS ---
[19:01:58] --- ATTACH_MENU ---
[19:02:01] ATTACH_MENU: Items: Start poll | Send image | Send video | Send file
[19:02:02] ATTACH_MENU: File input accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
[19:02:02] --- MESSAGE_BUBBLE ---
[19:02:02] MESSAGE_BUBBLE: 15 messages visible
[19:02:02] MESSAGE_BUBBLE: bubble=true, time=true, content=true
[19:02:02] MESSAGE_BUBBLE: Date separators: 0
[19:02:02] MESSAGE_BUBBLE: Messages with reactions: 0
[19:02:02] MESSAGE_BUBBLE: Thread badges: 0
[19:02:02] MESSAGE_BUBBLE: Edited messages: 0
[19:02:02] MESSAGE_BUBBLE: Read receipts: 9
[19:02:02] --- MSG_CONTEXT_MENU ---
[19:02:07] MSG_CONTEXT_MENU: Actions: Reply | Edit | Copy text | Copy link to message | Forward | Thread | Select | React | Delete (DANGER)
[19:02:07] MSG_CONTEXT_MENU: Receipts row: true
[19:02:08] MSG_CONTEXT_MENU: Closes on Escape
[19:02:08] --- MSG_REPLY ---
[19:02:11] MSG_REPLY: Reply preview shown, cancel btn: true
[19:02:14] MSG_REPLY: Reply quote visible: false
[19:02:14] --- MSG_EDIT ---
[19:02:17] MSG_EDIT: Edit mode activated with preview
[19:02:17] MSG_EDIT: Textarea pre-filled: "..."
[19:02:20] MSG_EDIT: Edited badge visible: false
[19:02:20] --- MSG_EDIT_CANCEL ---
[19:02:23] MSG_EDIT_CANCEL: PASS — Escape cancels edit
[19:02:23] --- MSG_FORWARD ---
[19:02:31] MSG_FORWARD: Search: true, rooms: 60
[19:02:32] --- MSG_SELECT ---
[19:02:35] MSG_SELECT: Selection count: "1 selected"
[19:02:35] MSG_SELECT: Selection action buttons: 4
[19:02:35] MSG_SELECT: Checkboxes visible: 6
[19:02:36] MSG_SELECT: After selecting 2nd: "2 selected"
[19:02:36] MSG_SELECT: Selection cancelled: true
[19:02:36] --- MSG_COPY ---
[19:02:39] MSG_COPY: Copy action clicked
[19:02:39] --- MSG_THREAD ---
[19:02:46] MSG_THREAD: Thread panel opened
[19:02:47] --- MSG_REACT ---
[19:02:56] MSG_REACT: Emoji picker opened
[19:02:56] --- MSG_DELETE ---
[19:03:05] MSG_DELETE: Redacted message visible: false
[19:03:11] Key restore screen detected — clicking Skip
[19:03:17] --- SETTINGS_NAV ---
[19:03:18] Key restore screen detected — clicking Skip
[19:03:23] SETTINGS_NAV: Sections: Profile, Appearance, Devices, Encryption, Language, Notifications, Приватность
[19:03:26] SETTINGS_NAV: Visited profile
[19:03:28] SETTINGS_NAV: Visited appearance
[19:03:30] SETTINGS_NAV: Visited devices
[19:03:32] SETTINGS_NAV: Visited encryption
[19:03:35] SETTINGS_NAV: Visited language
[19:03:38] SETTINGS_NAV: Visited notifications
[19:03:41] SETTINGS_NAV: Visited приватность
[19:03:41] --- SETTINGS_PROFILE ---
[19:03:43] Key restore screen detected — clicking Skip
[19:03:47] SETTINGS_PROFILE: Avatar: true
[19:03:47] SETTINGS_PROFILE: Display name: ""
[19:03:47] SETTINGS_PROFILE: Change avatar button: true
[19:03:47] SETTINGS_PROFILE: User ID visible: true
[19:03:47] SETTINGS_PROFILE: Save button: true
[19:03:47] --- SETTINGS_APPEARANCE ---
[19:03:49] Key restore screen detected — clicking Skip
[19:03:53] SETTINGS_APPEARANCE: Theme options: 4
[19:03:53] SETTINGS_APPEARANCE: Current theme: "System"
[19:03:57] SETTINGS_APPEARANCE: Theme switch works
[19:03:57] --- QUICK_REACTIONS ---
[19:03:58] Key restore screen detected — clicking Skip
[19:04:04] QUICK_REACTIONS: No messages, skipping
[19:04:04] --- HASHTAG_RENDER ---
[19:04:04] --- AT_ROOM_MENTION ---
[19:04:08] AT_ROOM_MENTION: PASS — @room option visible
[19:04:08] --- REPLY_TRUNCATION ---
[19:04:08] REPLY_TRUNCATION: No reply quotes visible, skipping
[19:04:08] --- DRAFT_PERSIST ---
[19:04:10] Key restore screen detected — clicking Skip
[19:04:17] Key restore screen detected — clicking Skip
[19:04:24] DRAFT_PERSIST: Draft not restored (got "@", expected "Draft test 1776020648521")
[19:04:24] --- IMAGE_CAPTION ---
[19:04:24] IMAGE_CAPTION: Attach button present (caption UI added to ImagePreviewDialog)
[19:04:24] --- MENTION_BADGE_LIST ---
[19:04:26] Key restore screen detected — clicking Skip
[19:04:31] MENTION_BADGE_LIST: Mention sent — event $lx_v46r2K6IKV9Dh7E4Qn2tnqucIIs5kqXioXe7JpFU
[19:04:37] Key restore screen detected — clicking Skip
[19:04:43] MENTION_BADGE_LIST: @ icons in room list: 1
[19:04:43] MENTION_BADGE_LIST: PASS — @ badge visible
[19:04:43] --- MENTION_SCROLL_ENTER ---
[19:04:45] Key restore screen detected — clicking Skip
[19:04:56] Key restore screen detected — clicking Skip
[19:05:09] BUG [LOW] MENTION_SCROLL_ENTER: URL does not contain eventId after clicking mentioned room. URL: http://localhost:5173/rooms/!JfgIWTMAouPIjMAzPb%3Alocalhost
[19:05:09] --- MENTION_NAVIGATOR ---
[19:05:14] Key restore screen detected — clicking Skip
[19:05:20] MENTION_NAVIGATOR: Navigator button not visible (highlightCount may be 0)
[19:05:20] --- MENTIONED_BUBBLE ---
[19:05:22] Key restore screen detected — clicking Skip
[19:05:28] MENTIONED_BUBBLE: 0 mentioned message(s) visible
[19:05:28] MENTIONED_BUBBLE: No mentioned messages visible (might need to scroll up)
[19:05:29] --- ROOM_MENTION ---
[19:05:30] Key restore screen detected — clicking Skip
[19:05:35] ROOM_MENTION: @room message sent
[19:05:41] Key restore screen detected — clicking Skip
[19:05:47] ROOM_MENTION: @ icons after @room: 1
[19:05:48] ROOM_MENTION: PASS
[19:05:48] --- REACTION_STABILITY ---
[19:05:49] Key restore screen detected — clicking Skip
[19:05:53] REACTION_STABILITY: No messages, skipping
[19:05:53] --- REACTION_RAPID_CLICKS ---
[19:05:53] REACTION_RAPID_CLICKS: No existing reactions, skipping
[19:05:53] --- TIMELINE_NO_JITTER ---
[19:05:53] --- PIN_MESSAGE_LIVE ---
[19:05:53] --- PRIVACY_SETTINGS ---
[19:05:55] Key restore screen detected — clicking Skip
[19:06:00] PRIVACY_SETTINGS: 2 privacy toggles found
[19:06:00] PRIVACY_SETTINGS: PASS
[19:06:00] PRIVACY_SETTINGS: Deactivate button: true
[19:06:00] --- IDLE_LOGOUT_SETTING ---
[19:06:02] Key restore screen detected — clicking Skip
[19:06:06] IDLE_LOGOUT_SETTING: 6 timeout options
[19:06:06] IDLE_LOGOUT_SETTING: PASS
[19:06:06] --- VOICE_BUTTON ---
[19:06:08] Key restore screen detected — clicking Skip
[19:06:14] VOICE_BUTTON: No send button area
[19:06:14] --- SLASH_COMMANDS ---
[19:06:14] --- SEND_QUEUE_DB ---
[19:06:14] SEND_QUEUE_DB: send queue store exists: true
[19:06:14] --- SAVED_MESSAGES_NO_DUP ---
[19:06:16] Key restore screen detected — clicking Skip
[19:06:26] Key restore screen detected — clicking Skip
[19:06:36] SAVED_MESSAGES_NO_DUP: PASS — same room opened twice
[19:06:36] --- ENCRYPTED_RECOVERY_KEY ---
[19:06:36] ENCRYPTED_RECOVERY_KEY: shape=null, encrypted=false
[19:06:36] --- LOGGER_MODULE ---
[19:06:36] LOGGER_MODULE: App loaded OK at http://localhost:5173/rooms/!ksDCsAwLROULxYbJfn%3Alocalhost
[19:06:36] --- TOUCH_TARGETS ---
[19:06:38] Key restore screen detected — clicking Skip
[19:06:42] TOUCH_TARGETS: PASS
[19:06:42] --- SKIP_LINK ---
[19:06:43] Key restore screen detected — clicking Skip
[19:06:47] SKIP_LINK: PASS
[19:06:47] --- CROSS_SIGNING_UI_PRESENT ---
[19:06:48] Key restore screen detected — clicking Skip
[19:06:54] CROSS_SIGNING_UI_PRESENT: Verify button: true
[19:06:54] --- ROOM_LIST_TABS ---
[19:06:55] Key restore screen detected — clicking Skip
[19:07:00] ROOM_LIST_TABS: 4 tab buttons
[19:07:03] ROOM_LIST_TABS: Unread tab clicked
[19:07:07] ROOM_LIST_TABS: PASS
[19:07:07] --- ROOM_NOTIFY_LEVELS ---
[19:07:09] Key restore screen detected — clicking Skip
[19:07:18] ROOM_NOTIFY_LEVELS: PASS — All/Mentions/Mute available
[19:07:19] --- EMOJI_AUTOCOMPLETE ---
[19:07:20] Key restore screen detected — clicking Skip
[19:07:30] EMOJI_AUTOCOMPLETE: PASS — popup with emoji candidates
[19:07:31] --- MULTI_FILE_INPUT ---
[19:07:31] MULTI_FILE_INPUT: PASS — multiple attribute set
[19:07:31] --- LIGHTBOX_NAV ---
[19:07:31] LIGHTBOX_NAV: skipped (requires media setup)
[19:07:31] --- MEMBER_ACTIONS ---
[19:07:35] MEMBER_ACTIONS: 0 action buttons found
[19:07:36] --- ROOM_NAME_EDITABLE ---
[19:07:38] ROOM_NAME_EDITABLE: No room name element
[19:07:38] --- FREQUENT_EMOJI ---
[19:07:38] FREQUENT_EMOJI: localStorage value: empty (defaults)
[19:07:38] --- I18N_CLEANUP ---
[19:07:40] Key restore screen detected — clicking Skip
[19:07:46] I18N_CLEANUP: Settings page loaded OK
[19:07:46] --- HIGH_CONTRAST_CSS ---
[19:07:46] HIGH_CONTRAST_CSS: PASS — @media (prefers-contrast) detected
[19:07:46] --- CALL_BUTTONS_DM ---
[19:07:47] Key restore screen detected — clicking Skip
[19:07:53] CALL_BUTTONS_DM: header buttons: Голосовой звонок | Видеозвонок | Invite user
[19:07:54] CALL_BUTTONS_DM: PASS
[19:07:54] --- INCOMING_CALL_CONTAINER ---
[19:07:55] Key restore screen detected — clicking Skip
[19:08:00] INCOMING_CALL_CONTAINER: PASS — app loaded with global CallContainer
[19:08:00] --- MEMBER_ONLINE ---
[19:08:02] Key restore screen detected — clicking Skip
[19:08:11] MEMBER_ONLINE: 9 avatars in room details
[19:08:12] --- ROOM_AVATAR_EDIT ---
[19:08:14] ROOM_AVATAR_EDIT: Avatar upload label: false
[19:08:14] --- SPACES_CONTEXT ---
[19:08:16] Key restore screen detected — clicking Skip
[19:08:21] SPACES_CONTEXT: No spaces button (no spaces created)
[19:08:21] --- BUNDLE_VISUALIZER ---
[19:08:21] BUNDLE_VISUALIZER: PASS — installed v^7.0.1
[19:08:21] --- CONTRAST_FIX ---
[19:08:23] Key restore screen detected — clicking Skip
[19:08:28] CONTRAST_FIX: --color-text-secondary = #5a627a
[19:08:28] CONTRAST_FIX: PASS — improved to #5a627a
[19:08:28] --- SYNC_PERSISTED ---
[19:08:28] SYNC_PERSISTED: corp-matrix-sync DB exists: true
[19:08:28] SYNC_PERSISTED: PASS
[19:08:28] --- LAZY_CHUNKS ---
[19:08:29] Key restore screen detected — clicking Skip
[19:08:35] LAZY_CHUNKS: Lightbox loaded initially: false
[19:08:35] LAZY_CHUNKS: EmojiPicker loaded initially: false
[19:08:35] --- SWIPE_REPLY ---
[19:08:37] Key restore screen detected — clicking Skip
[19:08:43] SWIPE_REPLY: No message, skipping
[19:08:43] --- THREAD_BACK_BUTTON ---
[19:08:43] --- XSS_SANITIZATION ---
[19:08:43] --- ERROR_BOUNDARY ---
[19:08:43] ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)
[19:08:43] --- CRYPTO_BANNER ---
[19:08:45] Key restore screen detected — clicking Skip
[19:08:49] CRYPTO_BANNER: PASS — no warning banner (crypto is working)
[19:08:49] --- SEND_ERROR_FEEDBACK ---
[19:08:50] Key restore screen detected — clicking Skip
[19:08:55] SEND_ERROR_FEEDBACK: Textarea aria-label="Type a message..."
[19:08:55] SEND_ERROR_FEEDBACK: PASS
[19:08:55] --- TIMELINE_A11Y ---
[19:08:55] TIMELINE_A11Y: role="log" found, aria-live="polite"
[19:08:55] TIMELINE_A11Y: Composer form has role="form"
[19:08:55] TIMELINE_A11Y: PASS
[19:08:55] --- SECURITY_HEADERS ---
[19:08:55] SECURITY_HEADERS: Page loaded OK (CSP not blocking app)
[19:08:55] SECURITY_HEADERS: CSP meta tag: false
[19:08:55] --- ENCRYPTION_SETTINGS ---
[19:08:57] Key restore screen detected — clicking Skip
[19:09:14] ENCRYPTION_SETTINGS: Key backup button: false
[19:09:14] ENCRYPTION_SETTINGS: Has backup-related content: true
[19:09:14] --- DEVICES_SETTINGS ---
[19:09:15] Key restore screen detected — clicking Skip
[19:09:21] DEVICES_SETTINGS: Device elements: 3
[19:09:21] DEVICES_SETTINGS: Current device indicator: true
[19:09:21] DEVICES_SETTINGS: Device IDs found: 1
[19:09:21] --- DEVICE_PROLIFERATION ---
[19:09:22] DEVICE_PROLIFERATION: Total devices for @testuser1:localhost: 3
[19:09:22]   Device: EBLITBHELL | name="-" | last_seen=2026-04-12T19:09:17
[19:09:22]   Device: LOGGMIVATK | name="-" | last_seen=2026-04-12T19:02:16
[19:09:22]   Device: NVCKEOIVPP | name="-" | last_seen=2026-04-12T19:09:21
[19:09:22] --- KEY_BACKUP_STATUS ---
[19:09:22] KEY_BACKUP_STATUS: Backup exists — version=24, algorithm=m.megolm_backup.v1.curve25519-aes-sha2
[19:09:22] --- ENCRYPTED_MESSAGES ---
[19:09:23] Key restore screen detected — clicking Skip
[19:09:29] ENCRYPTED_MESSAGES: No UTD indicators found
[19:09:29] ENCRYPTED_MESSAGES: Encryption badge in header: false
[19:09:29] --- CROSS_SIGNING_UI ---
[19:09:31] Key restore screen detected — clicking Skip
[19:09:49] CROSS_SIGNING_UI: Verify button: true
[19:09:49] CROSS_SIGNING_UI: Cross-signing info: true, Verification info: true
[19:09:49] --- D1_CONTEXT_REACTIVITY ---
[19:09:51] Key restore screen detected — clicking Skip
[19:10:06] Key restore screen detected — clicking Skip
[19:10:13] Key restore screen detected — clicking Skip
[19:10:19] D1_CONTEXT_REACTIVITY: PASS
[19:10:19] --- CREATE_POLL ---
[19:10:21] Key restore screen detected — clicking Skip
[19:10:36] CREATE_POLL: PASS
[19:10:36] --- POLL_VOTE ---
[19:10:38] Key restore screen detected — clicking Skip
[19:10:42] POLL_VOTE: SKIP (no poll from previous test)
[19:10:42] --- READ_RECEIPTS_VISUAL ---
[19:10:50] READ_RECEIPTS_VISUAL: PASS
[19:10:50] --- TYPING_INDICATOR ---
[19:11:07] Room entered but composer not found
[19:11:09] --- INVITE_ACCEPT_DECLINE ---
[19:11:18] Key restore screen detected — clicking Skip
[19:11:25] INVITE_ACCEPT_DECLINE: PASS
[19:11:25] --- CREATE_SPACE ---
[19:11:27] Key restore screen detected — clicking Skip
[19:11:35] CREATE_SPACE: SKIP (modal is not "create space")
[19:11:35] --- MESSAGE_SEARCH_WIRED ---
[19:11:36] Key restore screen detected — clicking Skip
[19:11:43] MESSAGE_SEARCH_WIRED: PASS — search button opens SearchPanel modal
[19:11:44] --- KEY_RESTORE_METHODS ---
[19:11:44] KEY_RESTORE_METHODS: SKIP (screen not visible, keys already loaded)
[19:11:44] --- NETWORK_RECONNECT ---
[19:11:45] Key restore screen detected — clicking Skip
[19:12:04] NETWORK_RECONNECT: PASS
[19:12:04] --- SW_REGISTERED ---
[19:12:05] Key restore screen detected — clicking Skip
[19:12:11] SW: controller=http://localhost:5173/dev-sw.js?dev-sw, registrations=1
[19:12:11] SW_REGISTERED: PASS
[19:12:11] --- STRESS_MESSAGES ---
[19:12:17] Key restore screen detected — clicking Skip
[19:12:31] STRESS_MESSAGES: new console errors=1
[19:12:31] STRESS_MESSAGES: PASS
[19:12:31] --- RESPONSIVE_MOBILE ---
[19:12:38] Key restore screen detected — clicking Skip
[19:12:46] RESPONSIVE_mobile: Back button in room: false
[19:12:46] RESPONSIVE_mobile: Composer visible: true
[19:12:48] Key restore screen detected — clicking Skip
[19:12:52] --- RESPONSIVE_TABLET ---
[19:12:59] Key restore screen detected — clicking Skip
[19:13:08] RESPONSIVE_tablet: Back button in room: false
[19:13:08] RESPONSIVE_tablet: Composer visible: true
[19:13:10] Key restore screen detected — clicking Skip
[19:13:14] ═══ MULTI-USER TEST ═══
[19:13:20] Key restore screen detected — clicking Skip
[19:13:24] MULTI_USER: User2 logged in
[19:13:33] Key restore screen detected — clicking Skip
[19:13:38] --- SETTINGS_LOGOUT ---
[19:13:39] Key restore screen detected — clicking Skip
[19:13:45] SETTINGS_LOGOUT: Modal text: "Вы уверены, что хотите выйти из аккаунта?"
[19:13:46] SETTINGS_LOGOUT: Cancel closes modal: true
[19:13:52] SETTINGS_LOGOUT: PASS — redirected to /login
[19:13:52] --- AUTH_EMPTY ---
[19:13:58] AUTH_EMPTY: PASS — validation works
[19:13:58] --- AUTH_WRONG_CREDS ---
[19:14:08] AUTH_WRONG_CREDS: PASS — error: "MatrixError: [403] Invalid username or password (http://127.0.0.1:8008/_matrix/client/v3/login)"
[19:14:08] --- REGISTER_PAGE ---
[19:14:11] Register page has 4 input fields
[19:14:11] REGISTER_PAGE: Login link present
[19:14:11] --- REGISTER_MISMATCH ---
[19:14:18] REGISTER_MISMATCH: PASS — error shown for mismatch
[19:14:18] --- CONSOLE_ERRORS ---
[19:14:18] CONSOLE_ERRORS: None (105 filtered as harmless)
[19:14:18] --- NETWORK_ERRORS ---
[19:14:18] NETWORK_ERRORS: None
[19:14:18] ═══ POST-RUN CLEANUP ═══
[19:14:18] Cleanup: purging stale test rooms from previous runs...
[19:14:20]   No stale test rooms found
```
