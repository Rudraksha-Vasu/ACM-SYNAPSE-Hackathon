const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sourcePath = path.join(__dirname, fs.existsSync(path.join(__dirname, '../public/reviewer.js')) ? '../public/reviewer.js' : '../dist/reviewer.js');
const loaded = require(sourcePath);
const writer = loaded.reviewDraft ? loaded : globalThis.PhishGuardWriter;

const ordinary = {
  to: 'alex@team.example',
  subject: 'Project meeting update',
  body: 'Hi Alex,\n\nHere is the project update for our meeting on Friday.\n\nThanks,\nParth'
};

test('ordinary draft is valid and its meaning is preserved', () => {
  const result = writer.reviewDraft(ordinary);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.correctedSubject, ordinary.subject);
  assert.equal(result.correctedBody, ordinary.body);
});

test('only one plain recipient is accepted', () => {
  for (const to of ['alex@team.example, sam@team.example', 'alex@team.example;sam@team.example', 'Alex <alex@team.example>']) {
    const result = writer.reviewDraft({ ...ordinary, to });
    assert.equal(result.valid, false, to);
    assert.ok(result.errors.length > 0);
  }
});

test('recipient and subject reject header injection', () => {
  for (const draft of [
    { ...ordinary, to: 'alex@team.example\r\nBcc: other@team.example' },
    { ...ordinary, subject: 'Meeting\r\nBcc: other@team.example' }
  ]) {
    const result = writer.reviewDraft(draft);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  }
});

test('message is required while recipient and subject are optional', () => {
  assert.equal(writer.reviewDraft({ body: ordinary.body }).valid, true);
  assert.equal(writer.reviewDraft({ ...ordinary, to: '', subject: '' }).valid, true);
  assert.equal(writer.reviewDraft({ ...ordinary, body: '   ' }).valid, false);
});

test('oversized subjects and bodies are rejected', () => {
  assert.equal(writer.reviewDraft({ ...ordinary, subject: 'a'.repeat(501) }).valid, false);
  assert.equal(writer.reviewDraft({ ...ordinary, body: 'a'.repeat(50001) }).valid, false);
});

test('common spelling errors and a lowercase pronoun have suggested corrections', () => {
  const body = 'Hi Alex,\n\ni am writting to recieve teh seperate report.\n\nThanks,\nParth';
  const result = writer.reviewDraft({ ...ordinary, body });
  assert.equal(result.valid, true);
  assert.ok(result.correctedBody.includes('I am writing to receive the separate report.'));
  assert.ok(result.suggestions.some((suggestion) => suggestion.applicable));
  assert.ok(result.counts.corrections > 0);
  for (const suggestion of result.suggestions) {
    assert.equal(typeof suggestion.id, 'string');
    assert.equal(typeof suggestion.title, 'string');
    assert.equal(typeof suggestion.detail, 'string');
    assert.equal(typeof suggestion.applicable, 'boolean');
  }
});

test('corrects common misspellings, sentence capitalization, and punctuation spacing', () => {
  const result = writer.reviewDraft({
    ...ordinary,
    subject: 'accomodate the enviroment',
    body: 'dear Alex ,Please recieve the file,when convenient. The total is INR 1,250.'
  });
  assert.equal(result.correctedSubject, 'Accommodate the environment');
  assert.equal(result.correctedBody, 'Dear Alex, Please receive the file, when convenient. The total is INR 1,250.');
  assert.ok(result.suggestions.some((suggestion) => suggestion.category === 'capitalization'));
  assert.ok(result.suggestions.some((suggestion) => suggestion.category === 'punctuation'));
});

test('common unpunctuated contractions can be corrected', () => {
  const result = writer.reviewDraft({ ...ordinary, body: 'Hi Alex,\n\nim available tomorrow. i dont think we cant finish. ive attached the notes.\n\nThanks,\nParth' });
  assert.match(result.correctedBody, /I['’]m available/);
  assert.match(result.correctedBody, /don['’]t/);
  assert.match(result.correctedBody, /can['’]t/);
  assert.match(result.correctedBody, /I['’]ve attached/);
});

test('URLs, email addresses, code, names, dates, and amounts remain intact', () => {
  const body = [
    'Hi Alex,', '',
    'Parth Dave will pay INR 1,250 on 24/10/2026.',
    'Use https://example.com/teh/recieve?name=seperate or contact teh@example.com.',
    'Keep `recieve = 3` unchanged.',
    '```js\nconst im = "teh";\n```', '',
    'Thanks,', 'Parth'
  ].join('\n');
  const result = writer.reviewDraft({ ...ordinary, body });
  for (const fragment of [
    'Parth Dave', 'INR 1,250', '24/10/2026',
    'https://example.com/teh/recieve?name=seperate', 'teh@example.com',
    '`recieve = 3`', '```js\nconst im = "teh";\n```'
  ]) assert.ok(result.correctedBody.includes(fragment), fragment);
});

test('paragraph and line breaks are preserved during corrections', () => {
  const body = 'Hi Alex,\n\ni am writting today.\nPlease recieve the file.\n\nThanks,\nParth';
  const result = writer.reviewDraft({ ...ordinary, body });
  assert.equal((result.correctedBody.match(/\n/g) || []).length, (body.match(/\n/g) || []).length);
  assert.ok(result.correctedBody.includes('\n\nI am writing today.\nPlease receive the file.\n\n'));
});

test('applying every correction is idempotent', () => {
  const first = writer.reviewDraft({ ...ordinary, subject: 'teh seperate report', body: 'Hi Alex,\n\ni am writting to recieve teh report.\n\nThanks,\nParth' });
  const second = writer.reviewDraft({ ...ordinary, subject: first.correctedSubject, body: first.correctedBody });
  assert.equal(second.correctedSubject, first.correctedSubject);
  assert.equal(second.correctedBody, first.correctedBody);
  assert.equal(second.counts.corrections, 0);
});

test('structural tips are advisory and do not invent text', () => {
  const body = 'Please review the attached report.';
  const result = writer.reviewDraft({ ...ordinary, subject: 'Report review', body });
  assert.equal(result.correctedBody, body);
  assert.ok(result.suggestions.some((suggestion) => !suggestion.applicable));
  assert.ok(result.counts.tips > 0);
});

test('reviewing text does not require the optional phishing engine', () => {
  const previous = globalThis.PhishGuard;
  delete globalThis.PhishGuard;
  try {
    const result = writer.reviewDraft(ordinary);
    assert.equal(result.valid, true);
    assert.equal(result.security, null);
  } finally {
    if (previous !== undefined) globalThis.PhishGuard = previous;
  }
});

test('online review maps LanguageTool suggestions and never submits the recipient', async () => {
  let request;
  const subject = 'teh plan';
  const body = 'this are a test.';
  const result = await writer.reviewDraftOnline({ to: 'private@example.com', subject, body }, async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        matches: [
          { offset: 0, length: 3, message: 'Spelling suggestion', replacements: [{ value: 'The' }], rule: { category: { name: 'Spelling' } } },
          { offset: subject.length + 1, length: 4, message: 'Grammar suggestion', replacements: [{ value: 'These' }], rule: { category: { name: 'Grammar' } } }
        ]
      })
    };
  });
  const payload = new URLSearchParams(request.options.body);
  assert.equal(request.url, 'https://api.languagetool.org/v2/check');
  assert.deepEqual([...payload.keys()].sort(), ['language', 'text']);
  assert.equal(payload.get('language'), 'en-US');
  assert.equal(payload.get('text'), subject + '\n' + body);
  assert.equal(payload.get('text').includes('private@example.com'), false);
  assert.equal(result.online, true);
  assert.equal(result.correctedSubject, 'The plan');
  assert.equal(result.correctedBody, 'These are a test.');
  assert.deepEqual(result.suggestions.filter((suggestion) => suggestion.applicable).map((suggestion) => suggestion.field), ['subject', 'body']);
});

test('online review enforces the API size limit and rejects unavailable service responses', async () => {
  let called = false;
  await assert.rejects(
    writer.reviewDraftOnline({ body: 'a'.repeat(20000) }, async () => { called = true; }),
    /20,000 characters/
  );
  assert.equal(called, false);
  await assert.rejects(
    writer.reviewDraftOnline({ body: ordinary.body }, async () => ({ ok: false, status: 503 })),
    /HTTP 503/
  );
});

test('body-only draft copies exactly the approved message', () => {
  const result = writer.createDraft({ body: ordinary.body });
  assert.equal(result.valid, true);
  assert.equal(result.text, ordinary.body);
  assert.equal(result.to, '');
  assert.equal(result.subject, '');
});

test('full draft separates optional headers from message paragraphs', () => {
  const result = writer.createDraft(ordinary);
  assert.equal(result.text, 'To: ' + ordinary.to + '\nSubject: ' + ordinary.subject + '\n\n' + ordinary.body);
  assert.equal(result.body, ordinary.body);
});

test('creating a draft keeps wording the user chose without silently correcting it', () => {
  const body = 'Hi Alex,\n\ni am writting today.\n\nThanks,\nSam';
  assert.equal(writer.createDraft({ body }).body, body);
  assert.equal(writer.createDraft({ body }).text, body);
});

test('draft creation rejects empty messages and injected header lines', () => {
  assert.equal(writer.createDraft({ body: '' }).valid, false);
  assert.equal(writer.createDraft({ ...ordinary, to: '\n' }).valid, false);
  assert.equal(writer.createDraft({ ...ordinary, subject: 'Update\nBcc: other@example.com' }).valid, false);
});

test('draft output is an independent snapshot of the approved input', () => {
  const input = { ...ordinary };
  const result = writer.createDraft(input);
  input.body = 'Changed later';
  assert.equal(result.body, ordinary.body);
  assert.equal(result.text.endsWith(ordinary.body), true);
});
