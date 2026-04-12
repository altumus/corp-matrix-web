import { chromium } from 'playwright';
import fs from 'fs';
import { CONFIG, bugs, consoleErrors, networkErrors, testLog } from './lib/config.js';
import { log, listen, loginAs, runTest, snap } from './lib/helpers.js';
import { setup, cleanupAfterRun } from './lib/setup.js';

// Import all test functions
import { discover, discoverPostAuth } from './tests/discovery.js';
import { testAuthLogin, testAuthEmpty, testAuthWrongCreds, testRegisterPage, testRegisterMismatch } from './tests/auth.js';
import { testRoomListDisplay, testRoomSearch, testRoomListContextMenu, testRoomSwitch, testCreateRoom, testRoomListTabs, testRoomNotificationLevels } from './tests/room-list.js';
import { testRoomHeader, testEmptyRoom, testDMRoom, testTimelineScroll } from './tests/room.js';
import { testChatSendMessage, testChatSendEnter, testChatShiftEnter, testChatSendEmpty, testChatLongMessage, testChatSpecialChars, testAttachMenu } from './tests/messaging.js';
import { testMessageBubble, testMessageContextMenu, testReplyMessage, testEditMessage, testEditCancel, testForwardMessage, testForwardComplete, testSelectMessages, testCopyMessage, testThread, testReactMessage, testDeleteMessage, testContextMenuAllActions, testReplyQuote } from './tests/interactions.js';
import { testSettingsNavigation, testSettingsProfile, testSettingsAppearance, testSettingsLogout, testPrivacySettings, testIdleLogoutSetting } from './tests/settings.js';
import { testMentionBadgeInRoomList, testMentionScrollOnEnter, testMentionNavigator, testMentionedBubble, testRoomMention, testAtRoomMention } from './tests/mentions.js';
import { testEncryptionSettings, testDevicesSettings, testDeviceProliferation, testKeyBackupStatus, testEncryptedMessages, testCrossSigningUI, testCrossSigningUiNew, testEncryptedRecoveryKey, testCryptoBanner } from './tests/encryption.js';
import { testReactionStability, testReactionRapidClicks, testQuickReactions } from './tests/reactions.js';
import { testCreatePoll, testVotePoll } from './tests/polls.js';
import { testResponsive, testTouchTargetSize, testHighContrastMode, testSwipeReply, testMobileLongPress } from './tests/responsive.js';
import { testCallButtonsInDM, testIncomingCallContainer, testMemberOnlineIndicator } from './tests/calls.js';
import { testXssSanitization, testErrorBoundary, testSendErrorFeedback, testTimelineAccessibility, testSecurityHeaders, testSkipLink } from './tests/security.js';
import {
  testScrollAfterSend, testScrollToBottomFab, testOfflineBanner, testTypingTimeout,
  testForwardEncryptedWarning, testVoiceButton, testVoiceRecordFlow, testSlashCommands,
  testEmojiAutocomplete, testMultiFileInput, testLightboxNav, testMemberActions,
  testRoomNameEditable, testFrequentEmoji, testI18nCleanup, testDraftPersistence,
  testImageCaption, testHashtags, testReplyTruncation, testContrastFix, testRoomAvatarEdit,
  testSpacesContext, testBundleVisualizer, testSavedMessagesNoDup, testSendQueueDB,
  testLoggerExists, testSyncTokenPersisted, testLazyChunks
} from './tests/ux.js';
import { testD1ContextReactivity, testKeyRestoreScreenContent, testNetworkReconnect, testServiceWorkerRegistered, testMessageSearchWired, testCreateSpaceFlow } from './tests/new-features.js';
import { testMultiUser, testInviteAcceptDecline, testTypingIndicatorVisual, testReadReceiptsVisual } from './tests/multi-user.js';
import { testTimelineNoJitter, testPinMessageLive, testThreadBackButton } from './tests/regression.js';
import { testStressMessages } from './tests/stress.js';
import { startFederationServers, stopFederationServers, testFederationInvite, testFederationMessage, testFederationAvatar } from './tests/federation.js'
import { testSsoButtonVisibility, testSsoCallbackRoute, testGroupCallButton, testGroupCallNotInDM, testKeyImportButton, testKeyImportDialog, testScrollPositionPreserved, testIosSafeArea, testConnectionBannerExists, testDockerfileExists } from './tests/new-functionality.js'

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
      bug('HIGH', 'CONSOLE_ERRORS', err.slice(0, 250), ['Captured from browser console'], '');
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

      // ══════ Phase 7h: New functionality tests ══════
      await runTest('SSO_BUTTON',          page, () => testSsoButtonVisibility(page));
      await runTest('SSO_CALLBACK',        page, () => testSsoCallbackRoute(page));
      await runTest('GROUP_CALL_BTN',      page, () => testGroupCallButton(page));
      await runTest('GROUP_CALL_NOT_DM',   page, () => testGroupCallNotInDM(page));
      await runTest('KEY_IMPORT_BTN',      page, () => testKeyImportButton(page));
      await runTest('KEY_IMPORT_DIALOG',   page, () => testKeyImportDialog(page));
      await runTest('SCROLL_POSITION',     page, () => testScrollPositionPreserved(page));
      await runTest('IOS_SAFE_AREA',       page, () => testIosSafeArea(page));
      await runTest('CONNECTION_BANNER',   page, () => testConnectionBannerExists(page));
      await runTest('DOCKERFILE',          page, () => testDockerfileExists());

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

    // ══════ Phase 10.5: Federation (Docker) ══════
      const fedReady = await startFederationServers();
      if (fedReady) {
        try {
          await runTest('FEDERATION_INVITE',  page, () => testFederationInvite(page));
          await runTest('FEDERATION_MESSAGE', page, () => testFederationMessage(page));
          await runTest('FEDERATION_AVATAR',  page, () => testFederationAvatar(page));
        } catch (e) { log(`Federation tests error: ${e.message}`); }
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

    // Stop federation containers if they were started
    await stopFederationServers().catch(() => {});
  }
}

main().catch(console.error);
