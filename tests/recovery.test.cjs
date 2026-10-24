const test = require('node:test');
const assert = require('node:assert/strict');
const recovery = require('../public/recovery-engine.js');
const planFor = (...selected) => recovery.buildPlan({ selected, region: 'india' });
const ids = plan => plan.actions.map(action => action.id);

test('recovery rejects missing, unknown, and conflicting categorical answers', () => {
  for (const input of [{}, { selected: [] }, { selected: ['injected-secret'] }, { selected: ['clicked', 'password'] }, { selected: ['unsure', 'clicked'] }, { selected: ['code'], region: 'unrecognised' }, { selected: ['code'], workDevice: 'yes' }]) {
    const plan = recovery.buildPlan(input);
    assert.equal(plan.valid, false);
    assert.ok(plan.errors.length);
    assert.deepEqual(plan.actions, []);
  }
});

test('click-only guidance does not imply account or device compromise and has no bank action', () => {
  const plan = planFor('clicked');
  assert.equal(plan.valid, true);
  assert.equal(plan.urgent, false);
  assert.ok(ids(plan).includes('review-device'));
  assert.ok(!ids(plan).includes('change-password'));
  assert.ok(!ids(plan).includes('contact-bank'));
  assert.match(plan.actions.find(a => a.id === 'review-device').detail, /does not establish compromise or safety/);
});

test('password and OTP steps combine without repeating session review', () => {
  const plan = planFor('password', 'code', 'password');
  assert.equal(plan.urgent, true);
  assert.ok(ids(plan).includes('change-password'));
  assert.ok(ids(plan).includes('secure-code'));
  assert.equal(ids(plan).filter(id => id === 'review-account').length, 1);
  assert.match(plan.actions.find(a => a.id === 'secure-code').detail, /expiring does not undo/);
});

test('bank and remote access actions take priority when multiple exposures combine', () => {
  const plan = planFor('password', 'code', 'moneySent', 'remote');
  assert.deepEqual(ids(plan).slice(0, 4), ['contain-device', 'contact-bank', 'secure-code', 'change-password']);
  assert.ok(ids(plan).includes('report-financial-india'));
  assert.match(plan.actions[0].detail, /different trusted device/);
});

test('unopened downloads receive different steps from executed software', () => {
  const downloaded = planFor('downloaded');
  assert.ok(ids(downloaded).includes('do-not-open'));
  assert.ok(!ids(downloaded).includes('contain-device'));
  const installed = planFor('downloaded', 'installed');
  assert.ok(ids(installed).includes('contain-device'));
  assert.ok(ids(installed).includes('check-device'));
  assert.ok(!ids(installed).includes('do-not-open'));
});

test('Indian financial reporting stays specific to India and financial loss', () => {
  assert.ok(ids(planFor('moneySent')).includes('report-financial-india'));
  assert.ok(!ids(planFor('paymentDetails')).includes('report-financial-india'));
  const abroad = recovery.buildPlan({ selected: ['moneySent'], region: 'other' });
  assert.ok(!ids(abroad).includes('report-financial-india'));
  assert.ok(ids(abroad).includes('report-financial-local'));
  assert.ok(!abroad.sources.some(s => s.url.includes('cybercrime.gov.in')));
});

test('work or school context directs users to IT before destructive recovery', () => {
  const plan = recovery.buildPlan({ selected: ['installed'], workDevice: true, region: 'india' });
  assert.ok(ids(plan).includes('tell-it'));
  assert.ok(ids(plan).indexOf('tell-it') < ids(plan).indexOf('check-device'));
  assert.match(plan.actions.find(a => a.id === 'check-device').detail, /IT team direct/);
  const download = recovery.buildPlan({ selected: ['downloaded'], workDevice: true });
  assert.match(download.actions.find(a => a.id === 'do-not-open').detail, /IT team direct handling before deleting/);
  assert.doesNotMatch(download.actions.find(a => a.id === 'do-not-open').detail, /Remove the suspicious/);
});

test('remote access or installed software protects accounts even without explicit password disclosure', () => {
  for (const exposure of ['remote', 'installed']) {
    const plan = planFor(exposure);
    assert.ok(ids(plan).includes('protect-device-accounts'));
    assert.ok(ids(plan).includes('review-account'));
    assert.ok(ids(plan).includes('secure-mfa'));
    assert.match(plan.actions.find(a => a.id === 'protect-device-accounts').detail, /different trusted device/);
  }
});

test('personal information and uncertainty have actionable paths', () => {
  assert.ok(ids(planFor('personal')).includes('protect-identity'));
  assert.ok(ids(planFor('unsure')).includes('review-uncertain-account'));
  assert.ok(ids(planFor('unsure')).includes('review-device'));
});

test('every detailed combination yields unique actions ordered by phase with official links', () => {
  const all = recovery.scenarios.filter(s => !['clicked', 'unsure'].includes(s.id)).map(s => s.id);
  const phases = { now: 0, next: 1, watch: 2 };
  const hosts = new Set(['consumer.ftc.gov', 'support.google.com', 'www.ncsc.gov.uk', 'support.microsoft.com', 'i4c.mha.gov.in', 'cybercrime.gov.in']);
  for (let mask = 1; mask < (1 << all.length); mask++) {
    const selected = all.filter((_, bit) => mask & (1 << bit));
    const plan = recovery.buildPlan({ selected, region: 'india', workDevice: true });
    assert.equal(plan.valid, true);
    assert.equal(new Set(ids(plan)).size, plan.actions.length);
    for (let i = 1; i < plan.actions.length; i++) assert.ok(phases[plan.actions[i - 1].phase] <= phases[plan.actions[i].phase]);
    for (const source of plan.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(hosts.has(url.hostname));
    }
  }
});

test('export contains selected advice, official help links, and relevant limits', () => {
  const plan = planFor('code', 'moneySent');
  const text = recovery.formatPlan(plan);
  assert.match(text, /I shared an OTP/);
  assert.match(text, /1930/);
  assert.match(text, /https:\/\/cybercrime.gov.in\//);
  assert.match(text, /does not scan your device/);
  assert.ok(!text.includes('I shared personal or identity information'));
  assert.equal(recovery.formatPlan(planFor()), '');
});
