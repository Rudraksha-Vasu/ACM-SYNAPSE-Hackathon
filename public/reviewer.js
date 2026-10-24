/* Local draft review. Conservative writing rules; no network or generated text. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PhishGuardWriter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var WORDS = {
    writting: 'writing', recieve: 'receive', recieved: 'received', recieving: 'receiving',
    teh: 'the', seperate: 'separate', seperately: 'separately', definately: 'definitely',
    adress: 'address', becuase: 'because', occured: 'occurred', untill: 'until',
    tommorow: 'tomorrow', reagrds: 'regards', accomodate: 'accommodate', acheive: 'achieve',
    aparent: 'apparent', arguement: 'argument', begining: 'beginning', beleive: 'believe',
    calender: 'calendar', comming: 'coming', definately: 'definitely', embarass: 'embarrass',
    enviroment: 'environment', goverment: 'government', independant: 'independent',
    knowlege: 'knowledge', maintainance: 'maintenance', neccessary: 'necessary',
    occassion: 'occasion', persue: 'pursue', recieveing: 'receiving', succesful: 'successful',
    truely: 'truly', untill: 'until', wierd: 'weird'
  };
  var CONTRACTIONS = { dont: "don't", cant: "can't", wont: "won't", isnt: "isn't", didnt: "didn't", doesnt: "doesn't", im: "I'm", ive: "I've" };

  function strings(input) {
    input = input && typeof input === 'object' ? input : {};
    return { to: typeof input.to === 'string' ? input.to : '', subject: typeof input.subject === 'string' ? input.subject : '', body: typeof input.body === 'string' ? input.body : '' };
  }

  function validateDraft(input) {
    var draft = strings(input), errors = [], to = draft.to.trim();
    if (/[\u0000-\u001f\u007f]/.test(draft.to)) errors.push('The optional recipient must not contain control characters.');
    else if (to && (/[\u0000-\u0020\u007f<>,;:]/.test(to) || /[\r\n]/.test(draft.to) || to.length > 254 || !/^[a-z0-9.!#$%&'*+\/?=^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(to) || to.split('@')[0].length > 64 || /^\.|\.$|\.\./.test(to.split('@')[0]))) errors.push('Use one plain email address, such as name@example.com. Multiple recipients and header control characters are not supported.');
    if (draft.subject.length > 500) errors.push('Keep the subject within 500 characters.');
    if (/[\u0000-\u001f\u007f]/.test(draft.subject)) errors.push('The subject must be a single line without control characters.');
    if (!draft.body.trim()) errors.push('Write an email message before reviewing or creating a draft.');
    if (draft.body.length > 50000) errors.push('Keep the message within 50,000 characters.');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft.body)) errors.push('Remove unsupported control characters from the message.');
    return { valid: errors.length === 0, errors: errors };
  }

  function protectedRanges(text) {
    // Technical strings and code are never rewritten by the writing rules.
    var re = /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\r\n]*`|<(script|style|pre|code)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b[a-z0-9.!#$%&'*+\/?=^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}|<[^>]*>|^(?: {4}|\t|(?:const|let|var|function|return|import|export|def|class)\s).*$/gim;
    var ranges = [], match;
    while ((match = re.exec(text))) ranges.push({ start: match.index, end: match.index + match[0].length });
    return ranges;
  }

  function reviewText(text, field) {
    var protectedParts = protectedRanges(text), edits = [], cursor = 0;
    function inspect(segment, start) {
      var words = /\b[a-z]+\b/gi, match;
      while ((match = words.exec(segment))) {
        var before = match[0], lower = before.toLowerCase(), after = null, category = null;
        var sentenceStart = !segment.slice(0, match.index).trim() || /(?:[.!?]\s+|\n{2,})\s*$/.test(segment.slice(0, match.index));
        if (Object.prototype.hasOwnProperty.call(WORDS, lower)) { after = WORDS[lower]; category = 'spelling'; }
        else if (Object.prototype.hasOwnProperty.call(CONTRACTIONS, lower)) { after = CONTRACTIONS[lower]; category = 'grammar'; }
        else if (before === 'i') { after = 'I'; category = 'grammar'; }
        if (after && before === before.toUpperCase()) {
          after = after.toUpperCase();
        } else if (after && (sentenceStart || (before.charAt(0) === before.charAt(0).toUpperCase() && before.charAt(0) !== before.charAt(0).toLowerCase()))) {
          after = after.charAt(0).toUpperCase() + after.slice(1);
        }
        if (!after && sentenceStart && before.charAt(0) !== before.charAt(0).toUpperCase()) {
          after = before.charAt(0).toUpperCase() + before.slice(1);
          category = 'capitalization';
        }
        if (after) edits.push({ start: start + match.index, end: start + match.index + before.length, before: before, after: after, category: category, field: field });
      }
      var punctuationSpace = /[ \t]+([,.;:!?])/g;
      while ((match = punctuationSpace.exec(segment))) {
        var afterPunctuation = segment.charAt(match.index + match[0].length);
        var numericComma = match[1] === ',' && /\d/.test(segment.charAt(match.index - 1)) && /\d/.test(afterPunctuation);
        var punctuationReplacement = match[1] + (/[A-Za-z0-9]/.test(afterPunctuation) && !numericComma ? ' ' : '');
        edits.push({ start: start + match.index, end: start + match.index + match[0].length, before: match[0], after: punctuationReplacement, category: 'punctuation', field: field });
      }
      var missingSpace = /([,;:])(?=[A-Za-z0-9])/g;
      while ((match = missingSpace.exec(segment))) {
        if (/[ \t]/.test(segment.charAt(match.index - 1))) continue;
        if (match[1] === ',' && /\d/.test(segment.charAt(match.index - 1)) && /\d/.test(segment.charAt(match.index + 1))) continue;
        edits.push({ start: start + match.index, end: start + match.index + 1, before: match[1], after: match[1] + ' ', category: 'punctuation', field: field });
      }
      var spaces = / {2,}/g;
      while ((match = spaces.exec(segment))) {
        var absolute = start + match.index;
        // Preserve indentation and intentionally blank lines.
        var lineStart = text.lastIndexOf('\n', absolute - 1) + 1;
        var beforeSpace = text.slice(lineStart, absolute);
        var next = text.charAt(absolute + match[0].length);
        if (!beforeSpace.trim() || !next || next === '\r' || next === '\n') continue;
        edits.push({ start: absolute, end: absolute + match[0].length, before: match[0], after: ' ', category: 'spacing', field: field });
      }
    }
    protectedParts.forEach(function (range) { inspect(text.slice(cursor, range.start), cursor); cursor = range.end; });
    inspect(text.slice(cursor), cursor);
    edits.sort(function (a, b) { return a.start - b.start; });
    var output = '', offset = 0;
    edits.forEach(function (edit) { output += text.slice(offset, edit.start) + edit.after; offset = edit.end; });
    output += text.slice(offset);
    return { text: output, edits: edits };
  }

  function reviewDraft(input) {
    var draft = strings(input), validation = validateDraft(draft);
    var subjectResult = reviewText(draft.subject.slice(0, 500), 'subject');
    var bodyResult = reviewText(draft.body.slice(0, 50000), 'body');
    var suggestions = [], groups = Object.create(null);
    subjectResult.edits.concat(bodyResult.edits).forEach(function (edit) {
      var key = edit.field + ':' + edit.category + ':' + edit.before + ':' + edit.after;
      if (groups[key]) { groups[key].occurrences++; return; }
      var suggestion = {
        id: 'correction-' + (suggestions.length + 1), title: edit.category === 'spacing' ? 'Use a single space between words' : edit.category === 'capitalization' ? 'Capitalize the sentence' : edit.category === 'punctuation' ? 'Fix punctuation spacing' : 'Correct ' + edit.before,
        detail: '', before: edit.before, after: edit.after, category: edit.category, applicable: true, field: edit.field, occurrences: 1
      };
      groups[key] = suggestion;
      suggestions.push(suggestion);
    });
    suggestions.forEach(function (s) { s.detail = (s.field === 'subject' ? 'Subject' : 'Message') + ': ' + (s.category === 'spacing' ? 'Use one space between words.' : s.category === 'capitalization' ? 'Capitalize the first word of the sentence.' : 'Replace “' + s.before + '” with “' + s.after + '”.') + (s.occurrences > 1 ? ' Found in ' + s.occurrences + ' places.' : ''); });
    function tip(id, title, detail, category) { suggestions.push({ id: id, title: title, detail: detail, before: '', after: '', category: category || 'structure', applicable: false }); }
    if (!draft.subject.trim()) tip('tip-subject', 'Add a subject', 'Summarise the purpose in a short, specific subject.');
    else if (/^(?:hi|hello|question|help|urgent|request|update|meeting|hey|test)[!.?]*$/i.test(draft.subject.trim())) tip('tip-specific-subject', 'Make the subject more specific', 'A topic or requested action can help the recipient understand your message.');
    if (draft.body.trim() && !/^\s*(?:hi|hello|dear|good morning|good afternoon|good evening|hey)\b/i.test(draft.body)) tip('tip-greeting', 'Consider a greeting', 'A short greeting can make the message feel more personal. This is a suggestion, not a required correction.');
    if (draft.body.trim() && !/(?:^|\n)\s*(?:thanks|thank you|regards|best(?: regards)?|kind regards|sincerely|cheers)\b/i.test(draft.body.slice(-350))) tip('tip-signoff', 'Consider a closing', 'End with a brief thank-you or sign-off if it suits the message.');
    if (/\b(?:asap|do it now|you must|obviously|ridiculous|stupid)\b/i.test(draft.body)) tip('tip-tone', 'Review the tone', 'Check whether the wording matches the relationship and urgency you intend. No tone rewrite has been applied automatically.', 'tone');
    if (/\b(?:attached|attachment|enclosed)\b/i.test(draft.body)) tip('tip-attachment', 'Check the attachment', 'Remember to add the attachment in your chosen email app when you paste this draft.', 'reminder');
    var corrections = suggestions.filter(function (s) { return s.applicable; }).length;
    var tips = suggestions.length - corrections;
    var security = null;
    if (root && root.PhishGuard && typeof root.PhishGuard.analyzeEmail === 'function') {
      try { security = root.PhishGuard.analyzeEmail({ subject: draft.subject, body: draft.body }); } catch { /* The independent writing review remains available. */ }
    }
    return {
      valid: validation.valid, errors: validation.errors, suggestions: suggestions,
      correctedSubject: draft.subject.length > 500 ? draft.subject : subjectResult.text,
      correctedBody: draft.body.length > 50000 ? draft.body : bodyResult.text,
      summary: corrections ? corrections + (corrections === 1 ? ' correction is' : ' corrections are') + ' available. Review them before applying.' : 'No supported spelling or grammar corrections were found. Read the draft once before sending.',
      counts: { corrections: corrections, tips: tips }, security: security,
      limitations: ['Uses a small set of English writing rules, not a comprehensive grammar or factual check.', 'Names, dates, amounts, email addresses, URLs, and protected code are not intentionally rewritten. Review all changes before sending.']
    };
  }

  async function reviewDraftOnline(input, fetcher) {
    var draft = strings(input), result = reviewDraft(draft);
    if (!result.valid) return result;
    var text = draft.subject + '\n' + draft.body;
    if (text.length > 20000) throw new Error('Online review supports up to 20,000 characters per request. Local checks were used instead.');
    if (typeof fetcher !== 'function') fetcher = root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null;
    if (!fetcher) throw new Error('Online review is unavailable in this browser.');
    var response = await fetcher('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: text, language: 'en-US' }).toString()
    });
    if (!response.ok) throw new Error('LanguageTool returned HTTP ' + response.status + '. Local checks were used instead.');
    var payload = await response.json();
    if (!payload || !Array.isArray(payload.matches)) throw new Error('LanguageTool returned an unexpected response. Local checks were used instead.');

    var bodyOffset = draft.subject.length + 1;
    var candidates = payload.matches.map(function (match) {
      if (!Number.isInteger(match.offset) || !Number.isInteger(match.length) || match.length < 1 || !Array.isArray(match.replacements) || !match.replacements.length) return null;
      var end = match.offset + match.length, field, localOffset;
      if (match.offset >= 0 && end <= draft.subject.length) { field = 'subject'; localOffset = match.offset; }
      else if (match.offset >= bodyOffset && end <= text.length) { field = 'body'; localOffset = match.offset - bodyOffset; }
      else return null;
      var before = text.slice(match.offset, end), after = match.replacements[0].value;
      if (typeof after !== 'string' || after === before) return null;
      return { match: match, field: field, offset: match.offset, localOffset: localOffset, before: before, after: after };
    }).filter(Boolean);
    candidates.sort(function (a, b) { return a.offset - b.offset || b.match.length - a.match.length; });
    var accepted = [], lastEnd = -1;
    candidates.forEach(function (candidate) {
      if (candidate.offset < lastEnd) return;
      accepted.push(candidate);
      lastEnd = candidate.offset + candidate.match.length;
    });

    var subjectEdits = [], bodyEdits = [];
    var onlineSuggestions = accepted.map(function (candidate, index) {
      (candidate.field === 'subject' ? subjectEdits : bodyEdits).push(candidate);
      var category = candidate.match.rule && candidate.match.rule.category && candidate.match.rule.category.name;
      return {
        id: 'online-correction-' + (index + 1),
        title: 'LanguageTool' + (category ? ': ' + category : ' suggestion'),
        detail: candidate.match.message || 'Review this suggested replacement.',
        before: candidate.before,
        after: candidate.after,
        category: 'online',
        applicable: true,
        field: candidate.field,
        occurrences: 1
      };
    });
    function applyEdits(value, edits) {
      var output = '', cursor = 0;
      edits.forEach(function (edit) {
        output += value.slice(cursor, edit.localOffset) + edit.after;
        cursor = edit.localOffset + edit.before.length;
      });
      return output + value.slice(cursor);
    }
    var tips = result.suggestions.filter(function (suggestion) { return !suggestion.applicable; });
    result.suggestions = onlineSuggestions.concat(tips);
    result.correctedSubject = applyEdits(draft.subject, subjectEdits);
    result.correctedBody = applyEdits(draft.body, bodyEdits);
    result.counts = { corrections: onlineSuggestions.length, tips: tips.length };
    result.summary = onlineSuggestions.length
      ? onlineSuggestions.length + (onlineSuggestions.length === 1 ? ' LanguageTool suggestion is' : ' LanguageTool suggestions are') + ' available. Review them before applying.'
      : 'LanguageTool found no suggestions within its checks. Read the draft once before sending.';
    result.online = true;
    return result;
  }

  function createDraft(input) {
    var approved = strings(input), validation = validateDraft(approved);
    if (!validation.valid) return { valid: false, errors: validation.errors, to: '', subject: '', body: '', text: '' };
    var to = approved.to.trim(), subject = approved.subject.trim(), headers = [];
    if (to) headers.push('To: ' + to);
    if (subject) headers.push('Subject: ' + subject);
    return { valid: true, errors: [], to: to, subject: subject, body: approved.body,
      text: (headers.length ? headers.join('\n') + '\n\n' : '') + approved.body };
  }

  return { reviewDraft: reviewDraft, reviewDraftOnline: reviewDraftOnline, validateDraft: validateDraft, createDraft: createDraft, version: '1.1.0' };
});
