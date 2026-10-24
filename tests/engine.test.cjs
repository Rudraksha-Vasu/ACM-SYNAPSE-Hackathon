'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeUrl, analyzeEmail } = require('../public/engine.js');

function assertValidResult(result, kind) {
  assert.equal(result.kind, kind);
  assert.equal(result.valid, true);
  assert.ok(['low', 'medium', 'high'].includes(result.level));
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(Array.isArray(result.findings));
  assert.ok(Array.isArray(result.checks));
  assert.ok(Array.isArray(result.limitations));
}

function assertInvalid(result) {
  assert.equal(result.valid, false);
  assert.equal(result.level, 'invalid');
  assert.ok(result.errors.length > 0);
}

test('blank URL is rejected with an explanation', () => {
  assertInvalid(analyzeUrl('   '));
});

test('malformed URL is rejected', () => {
  assertInvalid(analyzeUrl('https://'));
});

test('javascript URLs are rejected', () => {
  assertInvalid(analyzeUrl('javascript:alert(1)'));
});

test('local file URLs are rejected', () => {
  assertInvalid(analyzeUrl('file:///etc/passwd'));
});

test('FTP URLs are outside the checker scope', () => {
  assertInvalid(analyzeUrl('ftp://files.example/report'));
});

test('normal HTTPS URL preserves destination and stays low concern', () => {
  const result = analyzeUrl('https://www.wikipedia.org/');
  assertValidResult(result, 'url');
  assert.equal(result.hostname, 'www.wikipedia.org');
  assert.equal(result.level, 'low');
});

test('scheme-less web hostname is handled without losing destination', () => {
  const result = analyzeUrl('www.wikipedia.org');
  assertValidResult(result, 'url');
  assert.equal(result.hostname, 'www.wikipedia.org');
});

test('userinfo disguise identifies actual destination and raises concern', () => {
  const result = analyzeUrl('https://paypal.com@account-review.example/login');
  assertValidResult(result, 'url');
  assert.equal(result.hostname, 'account-review.example');
  assert.ok(result.score > analyzeUrl('https://www.wikipedia.org/').score);
  assert.notEqual(result.level, 'low');
});

test('an @ character in the path is not treated as authority userinfo', () => {
  const base = analyzeUrl('https://www.wikipedia.org/wiki/Example');
  const result = analyzeUrl('https://www.wikipedia.org/wiki/@Example');
  assert.equal(result.hostname, 'www.wikipedia.org');
  assert.equal(result.level, 'low');
  assert.equal(result.score, base.score);
});

test('brand name nested under a different destination is not trusted', () => {
  const genuine = analyzeUrl('https://www.paypal.com/');
  const deceptive = analyzeUrl('https://paypal.com.attacker.example/login');
  assertValidResult(genuine, 'url');
  assertValidResult(deceptive, 'url');
  assert.equal(genuine.level, 'low');
  assert.ok(deceptive.score > genuine.score);
  assert.notEqual(deceptive.level, 'low');
});

test('genuine brand subdomains do not trigger an impersonation penalty', () => {
  const result = analyzeUrl('https://www.paypal.com/signin');
  assertValidResult(result, 'url');
  assert.equal(result.level, 'low');
});

test('HTTP contributes no less concern than the same HTTPS URL', () => {
  const https = analyzeUrl('https://docs.example/help');
  const http = analyzeUrl('http://docs.example/help');
  assertValidResult(http, 'url');
  assert.ok(http.score > https.score);
});

test('HTTPS does not erase deceptive domain evidence', () => {
  const result = analyzeUrl('https://paypal.com@account-review.example/login');
  assert.notEqual(result.level, 'low');
  assert.ok(result.findings.length > 0);
});

test('IP-address destination is reported as an address, not a brand domain', () => {
  const result = analyzeUrl('https://192.0.2.10/login');
  assertValidResult(result, 'url');
  assert.equal(result.hostname, '192.0.2.10');
  assert.ok(result.findings.length > 0);
});

test('blank email body is rejected', () => {
  assertInvalid(analyzeEmail({ sender: '', subject: '', body: '   ' }));
});

test('ordinary email has low concern', () => {
  const result = analyzeEmail({
    sender: 'teammate@college.example',
    subject: 'Project meeting',
    body: 'Hello team, our project meeting is at 3 pm in room 204. Please bring your notes. Thanks.'
  });
  assertValidResult(result, 'email');
  assert.equal(result.level, 'low');
});

test('urgency alone is insufficient for elevated concern', () => {
  const result = analyzeEmail({
    sender: 'teammate@college.example',
    subject: 'Urgent: meeting room changed',
    body: 'Please come to room 205 immediately. The projector in room 204 is unavailable.'
  });
  assertValidResult(result, 'email');
  assert.equal(result.level, 'low');
});

test('security education is not mistaken for a request for credentials', () => {
  const result = analyzeEmail({
    sender: 'security@college.example',
    subject: 'Security reminder',
    body: 'Never share your password or OTP. We will never ask you to send your password. Contact the IT desk if you receive a suspicious request.'
  });
  assertValidResult(result, 'email');
  assert.equal(result.level, 'low');
});

test('credential request with urgency and a deceptive link raises high concern', () => {
  const result = analyzeEmail({
    sender: 'support@account-review.example',
    subject: 'PayPal account suspended — act immediately',
    body: 'Your PayPal account will be blocked in 10 minutes. Verify your password and OTP immediately at https://paypal.com@account-review.example/login to avoid account suspension.'
  });
  assertValidResult(result, 'email');
  assert.equal(result.level, 'high');
  assert.ok(result.urls.length > 0);
});

test('repeating an identical link does not multiply its score', () => {
  const url = 'https://paypal.com@account-review.example/login';
  const single = analyzeEmail({ sender: '', subject: '', body: `Review this link: ${url}` });
  const repeated = analyzeEmail({ sender: '', subject: '', body: `Review this link: ${url} ${url} ${url}` });
  assert.equal(repeated.score, single.score);
});

test('plain-text and HTML www links are extracted for URL analysis', () => {
  const plain = analyzeEmail({ body: 'Review www.paypal.com.attacker.example/login before continuing.' });
  assertValidResult(plain, 'email');
  assert.equal(plain.urls.length, 1);
  assert.equal(plain.urls[0].hostname, 'www.paypal.com.attacker.example');
  assert.ok(plain.findings.some((finding) => finding.id === 'email.linkIndicators'));

  const html = analyzeEmail({ body: '<a href="www.paypal.com.attacker.example/login">www.paypal.com.attacker.example/login</a>' });
  assert.equal(html.urls.length, 1);
  assert.equal(html.urls[0].hostname, 'www.paypal.com.attacker.example');
});

test('HTML-like email content remains inert during analysis', () => {
  delete globalThis.__phishguardTestExecuted;
  const result = analyzeEmail({
    sender: '',
    subject: 'Example',
    body: '<script>globalThis.__phishguardTestExecuted = true</script><img src=x onerror="globalThis.__phishguardTestExecuted=true">Hello team.'
  });
  assertValidResult(result, 'email');
  assert.equal(globalThis.__phishguardTestExecuted, undefined);
});

test('findings provide readable evidence and points within score bounds', () => {
  const result = analyzeUrl('https://paypal.com@account-review.example/login');
  for (const finding of result.findings) {
    assert.equal(typeof finding.title, 'string');
    assert.ok(finding.title.length > 0);
    assert.equal(typeof finding.detail, 'string');
    assert.equal(typeof finding.evidence, 'string');
    assert.ok(Number.isFinite(finding.points));
  }
  assert.ok(result.limitations.length > 0);
});
