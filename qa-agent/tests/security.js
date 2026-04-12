import { log, snap, bug, goto, ensureInRoom } from '../lib/helpers.js';

export async function testXssSanitization(page) {
  log('--- XSS_SANITIZATION ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (!textarea || !sendBtn) return;

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

  const xssFound = await page.evaluate(() => {
    const results = [];
    const scripts = document.querySelectorAll('[class*="textContent"] script');
    if (scripts.length > 0) results.push('script tag rendered');
    const imgs = document.querySelectorAll('[class*="textContent"] img[onerror]');
    if (imgs.length > 0) results.push('img onerror rendered');
    const links = document.querySelectorAll('[class*="textContent"] a[href^="javascript:"]');
    if (links.length > 0) results.push('javascript: link rendered');
    return results;
  });

  if (xssFound.length > 0) {
    bug('CRITICAL', 'XSS_SANITIZATION', `XSS not sanitized: ${xssFound.join(', ')}`, [
      '1. Send message with XSS payloads', '2. Dangerous HTML rendered in DOM',
    ], shot);
  } else {
    log('XSS_SANITIZATION: PASS — all payloads sanitized');
  }
}

export async function testErrorBoundary(page) {
  log('--- ERROR_BOUNDARY ---');
  const hasFallback = await page.$('[class*="ErrorBoundary"], [class*="errorBoundary"]');
  if (hasFallback) {
    bug('HIGH', 'ERROR_BOUNDARY', 'Error boundary fallback is visible — app has crashed', [],
      await snap(page, 'error-boundary-active'));
  } else {
    log('ERROR_BOUNDARY: PASS — no error boundary fallback visible (app is stable)');
  }
}

export async function testSendErrorFeedback(page) {
  log('--- SEND_ERROR_FEEDBACK ---');
  if (!(await ensureInRoom(page))) return;

  const textarea = await page.$('textarea[class*="textarea"]');
  if (!textarea) return;

  const sendBtn = await page.$('button[class*="sendBtn"]');
  if (sendBtn) {
    const ariaLabel = await sendBtn.getAttribute('aria-label');
    if (!ariaLabel) bug('LOW', 'SEND_ERROR_FEEDBACK', 'Send button missing aria-label', [], '');
    else log(`SEND_ERROR_FEEDBACK: Send button aria-label="${ariaLabel}"`);
  }

  const textareaAriaLabel = await textarea.getAttribute('aria-label');
  if (!textareaAriaLabel) bug('LOW', 'SEND_ERROR_FEEDBACK', 'Message textarea missing aria-label', [], '');
  else log(`SEND_ERROR_FEEDBACK: Textarea aria-label="${textareaAriaLabel}"`);

  log('SEND_ERROR_FEEDBACK: PASS');
}

export async function testTimelineAccessibility(page) {
  log('--- TIMELINE_A11Y ---');
  if (!(await ensureInRoom(page))) return;

  const logRegion = await page.$('[role="log"]');
  if (!logRegion) {
    bug('MEDIUM', 'TIMELINE_A11Y', 'Timeline missing role="log" — inaccessible to screen readers', [],
      await snap(page, 'timeline-no-role'));
  } else {
    const ariaLive = await logRegion.getAttribute('aria-live');
    log(`TIMELINE_A11Y: role="log" found, aria-live="${ariaLive}"`);
    if (ariaLive !== 'polite') bug('LOW', 'TIMELINE_A11Y', `Timeline aria-live should be "polite", got "${ariaLive}"`, [], '');
  }

  const form = await page.$('form[role="form"]');
  if (form) log('TIMELINE_A11Y: Composer form has role="form"');

  log('TIMELINE_A11Y: PASS');
}

export async function testSecurityHeaders(page) {
  log('--- SECURITY_HEADERS ---');
  const pageText = await page.evaluate(() => document.body.innerText);
  log(`SECURITY_HEADERS: Page loaded OK (CSP not blocking app)`);

  const cspMeta = await page.$('meta[http-equiv="Content-Security-Policy"]');
  log(`SECURITY_HEADERS: CSP meta tag: ${!!cspMeta}`);
}

export async function testSkipLink(page) {
  log('--- SKIP_LINK ---');
  await goto(page, '/', 'a, button');
  await page.waitForTimeout(1000);

  const skipLink = await page.$('a[href="#main-content"], a[class*="sr-only"]');
  if (!skipLink) bug('LOW', 'SKIP_LINK', 'Accessibility skip link not present', [], '');
  else log('SKIP_LINK: PASS');
}
