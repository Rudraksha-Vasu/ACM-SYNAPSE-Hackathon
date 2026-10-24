(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var currentReview = null;
  var reviewedFingerprint = '';
  var preparedDraft = null;
  var preparedFingerprint = '';
  var dialog = $('draft-dialog');

  function node(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  function draft() {
    return { to: $('to-input').value.trim(), subject: $('draft-subject').value, body: $('draft-body').value };
  }
  function fingerprint(d) { return JSON.stringify([d.to, d.subject, d.body]); }
  function message(text) { $('writer-status').textContent = text; }
  function clearErrors() { $('draft-errors').hidden = true; $('draft-errors').replaceChildren(); }
  function showErrors(errors) {
    var box = $('draft-errors');
    box.replaceChildren();
    errors.forEach(function (error) { box.append(node('p', '', error)); });
    box.hidden = false;
  }
  function clearPreparedDraft() {
    preparedDraft = null;
    preparedFingerprint = '';
    $('draft-copy-status').textContent = '';
    $('manual-copy').value = '';
    $('manual-copy').hidden = true;
    $('manual-copy-label').hidden = true;
    if (dialog.open) dialog.close();
  }
  function clearReview() {
    currentReview = null;
    reviewedFingerprint = '';
    clearPreparedDraft();
    $('review-results').hidden = true;
    $('review-empty').hidden = false;
  }
  function inputChanged() {
    $('demo-draft-note').hidden = true;
    clearErrors();
    clearReview();
    message('Message changed. Review it again to prepare an updated draft.');
  }
  function renderSuggestion(suggestion, target) {
    var article = node('article', 'writing-suggestion');
    article.append(node('h3', '', suggestion.title), node('p', '', suggestion.detail));
    if (suggestion.applicable) {
      var pair = node('div', 'correction-comparison');
      pair.append(node('span', 'before-word', suggestion.before), node('span', '', '→'), node('span', 'after-word', suggestion.after));
      article.append(pair);
    }
    target.append(article);
  }
  async function review() {
    clearErrors();
    clearPreparedDraft();
    if (!window.PhishGuardWriter) {
      showErrors(['The writing checker could not load. Keep reviewer.js beside this page and reload.']);
      return;
    }
    var d = draft();
    var result = window.PhishGuardWriter.reviewDraft(d);
    if (!result.valid) {
      clearReview();
      showErrors(result.errors || ['Please check your message.']);
      message('Check the message details before continuing.');
      return;
    }
    var onlineError = '';
    if ($('online-review').checked) {
      var reviewButton = $('review-draft');
      reviewButton.disabled = true;
      message('Sending the subject and message to LanguageTool for review…');
      try {
        result = await window.PhishGuardWriter.reviewDraftOnline(d);
      } catch (error) {
        onlineError = error && error.message ? error.message : 'The service is unavailable. Local checks were used instead.';
      } finally {
        reviewButton.disabled = false;
      }
      if (fingerprint(d) !== fingerprint(draft())) return;
    }
    currentReview = result;
    reviewedFingerprint = fingerprint(d);
    $('review-empty').hidden = true;
    $('review-results').hidden = false;
    var corrections = (result.suggestions || []).filter(function (suggestion) { return suggestion.applicable; });
    var tips = (result.suggestions || []).filter(function (suggestion) { return !suggestion.applicable; });
    $('review-title').textContent = corrections.length ? 'A few small improvements' : 'Review ready';
    $('correction-count').textContent = corrections.length + ' correction' + (corrections.length === 1 ? '' : 's');
    $('review-summary').textContent = result.summary || '';
    $('correction-list').replaceChildren();
    $('tip-list').replaceChildren();
    corrections.forEach(function (suggestion) { renderSuggestion(suggestion, $('correction-list')); });
    tips.forEach(function (suggestion) {
      if (suggestion.id === 'tip-attachment') suggestion = Object.assign({}, suggestion, { detail: 'If your message mentions a file, attach it in your email app before sending.' });
      renderSuggestion(suggestion, $('tip-list'));
    });
    if (!corrections.length) $('correction-list').append(node('p', 'no-findings', 'No corrections were found by the selected review. Read the complete message once before creating your draft.'));
    $('apply-corrections').hidden = !corrections.length;
    $('tip-section').hidden = !tips.length;
    var security = $('draft-security');
    security.replaceChildren();
    security.hidden = true;
    if (result.security && result.security.valid && result.security.findings && result.security.findings.length) {
      security.hidden = false;
      security.append(node('h3', '', 'Content safety indicators'), node('p', '', result.security.summary || ''));
      var list = node('ul');
      result.security.findings.slice(0, 3).forEach(function (finding) { list.append(node('li', '', finding.title + ': ' + finding.detail)); });
      security.append(list, node('p', '', 'These are contextual warnings, not proof that your draft is harmful. Review the wording and links.'));
    }
    $('draft-readiness').textContent = corrections.length ? 'Apply any changes you want, or keep your own wording. Create the draft when you are satisfied.' : 'Ready to create a draft. You can copy its message and subject into any email app.';
    message('Review complete. ' + corrections.length + ' suggested correction' + (corrections.length === 1 ? '' : 's') + '.' + (onlineError ? ' ' + onlineError : ''));
  }
  async function applyCorrections() {
    if (!currentReview) return;
    $('draft-subject').value = currentReview.correctedSubject;
    $('draft-body').value = currentReview.correctedBody;
    await review();
    message('Suggested corrections applied. Read the updated message, then create your draft.');
  }
  function createDraft() {
    var d = draft();
    if (!currentReview || reviewedFingerprint !== fingerprint(d)) { review(); return; }
    if (!window.PhishGuardWriter || typeof window.PhishGuardWriter.createDraft !== 'function') {
      showErrors(['Draft preparation could not load. Reload the page and review your message again.']);
      return;
    }
    var prepared = window.PhishGuardWriter.createDraft(d);
    if (!prepared.valid) { showErrors(prepared.errors || ['Please check your message.']); return; }
    preparedDraft = prepared;
    preparedFingerprint = fingerprint(d);
    $('preview-to').textContent = prepared.to || '(Add in your email app)';
    $('preview-subject').textContent = prepared.subject || '(No subject)';
    $('preview-body').textContent = prepared.body;
    $('copy-subject').disabled = !prepared.subject;
    $('draft-copy-status').textContent = 'Draft created. Choose what you would like to copy.';
    $('manual-copy').hidden = true;
    $('manual-copy-label').hidden = true;
    if (!dialog.open) dialog.showModal();
    message('Your email draft is ready to copy.');
  }
  async function copyPrepared(part) {
    if (!preparedDraft || preparedFingerprint !== fingerprint(draft())) {
      clearReview();
      message('Message changed. Review it again before creating a new draft.');
      return;
    }
    var value = part === 'body' ? preparedDraft.body : part === 'subject' ? preparedDraft.subject : preparedDraft.text;
    var label = part === 'body' ? 'Message' : part === 'subject' ? 'Subject' : 'Full draft';
    if (!value) return;
    $('manual-copy').hidden = true;
    $('manual-copy-label').hidden = true;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        var temporary = node('textarea');
        temporary.value = value;
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        dialog.append(temporary);
        temporary.focus();
        temporary.select();
        var copied = document.execCommand('copy');
        temporary.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      $('draft-copy-status').textContent = label + ' copied. Paste it into your email app.';
      message(label + ' copied.');
    } catch {
      $('manual-copy').value = value;
      $('manual-copy-label').hidden = false;
      $('manual-copy').hidden = false;
      $('manual-copy').focus();
      $('manual-copy').select();
      $('draft-copy-status').textContent = 'Clipboard access is unavailable. The text is selected below; copy it manually.';
    }
  }

  $('draft-form').addEventListener('submit', function (event) { event.preventDefault(); review(); });
  ['to-input', 'draft-subject', 'draft-body'].forEach(function (id) { $(id).addEventListener('input', inputChanged); });
  $('apply-corrections').addEventListener('click', applyCorrections);
  $('create-draft').addEventListener('click', createDraft);
  $('edit-draft').addEventListener('click', function () { dialog.close(); });
  $('copy-message').addEventListener('click', function () { copyPrepared('body'); });
  $('copy-subject').addEventListener('click', function () { copyPrepared('subject'); });
  $('copy-full-draft').addEventListener('click', function () { copyPrepared('full'); });
  $('load-example').addEventListener('click', function () {
    $('to-input').value = 'teamlead@example.test';
    $('draft-subject').value = 'Project update for tommorow';
    $('draft-body').value = 'Hi Alex,\n\ni am writting to share teh project update. ive completed the interface and will send a seperate document tommorow. Please let me know when you recieve it.\n\nThanks,\nSam';
    clearErrors();
    clearReview();
    $('demo-draft-note').hidden = false;
    review();
  });
  $('reset-draft').addEventListener('click', function () {
    $('to-input').value = '';
    $('draft-subject').value = '';
    $('draft-body').value = '';
    $('demo-draft-note').hidden = true;
    clearErrors();
    clearReview();
    message('Message cleared.');
    $('draft-body').focus();
  });
}());
