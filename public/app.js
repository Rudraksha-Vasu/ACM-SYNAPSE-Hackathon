(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var mode = 'url';
  var currentResult = null;
  var currentInput = null;
  var demoLoaded = false;
  var EXAMPLES = {
    url: [
      { label: 'Deceptive address', type: 'suspicious', url: 'https://paypal.com@account-review.example/login' },
      { label: 'Ordinary URL', type: 'normal', url: 'https://www.wikipedia.org/' },
      { label: 'Shortened link', type: 'ambiguous', url: 'https://bit.ly/example' }
    ],
    email: [
      { label: 'Suspicious email', type: 'suspicious', sender: 'support@account-review.example', subject: 'PayPal: account suspended — action required', body: 'Your PayPal account will be blocked in 10 minutes. Verify your password and OTP immediately to restore access. Open https://paypal.com@account-review.example/login to complete verification.' },
      { label: 'Ordinary message', type: 'normal', sender: 'sam@team.example', subject: 'Notes from our project meeting', body: 'Hi team, here are the notes from today. Please review the interface mockups before our next meeting on Friday. Thanks, Sam.' },
      { label: 'Urgent, ordinary', type: 'ambiguous', sender: 'events@college.example', subject: 'Urgent: room change for today’s workshop', body: 'Hi everyone, the workshop has moved to Room 204. Please arrive in the next 10 minutes so we can start on time. Bring your laptop and notebook. Thank you.' }
    ]
  };
  var TITLES = { low: 'Few warning signs', medium: 'Take a closer look', high: 'Several warning signs', invalid: 'Check your input' };
  var LABELS = { low: 'Low concern', medium: 'Medium concern', high: 'High concern', invalid: 'Invalid input' };
  var COLORS = { low: '#b98531', medium: '#b58a36', high: '#b85b4d', invalid: '#8b8272' };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function setStatus(message) { $('action-status').textContent = message; }
  function clearResult() {
    currentResult = null;
    currentInput = null;
    $('empty-result').hidden = false;
    $('analysis-result').hidden = true;
    $('details-panel').hidden = true;
    $('input-errors').hidden = true;
    $('input-errors').replaceChildren();
    $('result-announcement').textContent = '';
    setStatus('');
  }
  function selectMode(nextMode, focus) {
    mode = nextMode;
    document.querySelectorAll('[role="tab"]').forEach(function (tab) {
      var selected = tab.dataset.mode === mode;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    $('url-panel').hidden = mode !== 'url';
    $('email-panel').hidden = mode !== 'email';
    $('analyze-label').textContent = mode === 'url' ? 'Analyze URL' : 'Analyze email';
    demoLoaded = false;
    $('demo-indicator').hidden = true;
    renderExamples();
    clearResult();
  }
  function renderExamples() {
    var container = $('example-buttons');
    container.replaceChildren();
    EXAMPLES[mode].forEach(function (example) {
      var button = element('button', 'example-button');
      button.type = 'button';
      button.append(element('span', 'example-dot ' + example.type), document.createTextNode(example.label));
      button.addEventListener('click', function () {
        if (mode === 'url') $('url-input').value = example.url;
        else {
          $('sender-input').value = example.sender;
          $('subject-input').value = example.subject;
          $('body-input').value = example.body;
        }
        demoLoaded = true;
        $('demo-indicator').hidden = false;
        analyze();
      });
      container.append(button);
    });
  }
  function showErrors(errors) {
    clearResult();
    var box = $('input-errors');
    (errors.length ? errors : ['Please check the content and try again.']).forEach(function (error) { box.append(element('p', '', error)); });
    box.hidden = false;
    var input = mode === 'url' ? $('url-input') : $('body-input');
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
  function analyze() {
    $('url-input').removeAttribute('aria-invalid');
    $('body-input').removeAttribute('aria-invalid');
    if (!window.PhishGuard) {
      showErrors(['The analysis engine could not load. Keep engine.js beside index.html and reload the page.']);
      return;
    }
    var input = mode === 'url' ? $('url-input').value : { sender: $('sender-input').value, subject: $('subject-input').value, body: $('body-input').value };
    try {
      var result = mode === 'url' ? window.PhishGuard.analyzeUrl(input) : window.PhishGuard.analyzeEmail(input);
      if (!result || !result.valid) { showErrors(result && result.errors ? result.errors : []); return; }
      currentResult = result;
      currentInput = input;
      renderResult(result);
      setStatus(demoLoaded ? 'Demo example analyzed. You can edit it and check again.' : 'Analysis complete.');
    } catch {
      showErrors(['This input could not be analyzed. Check the format and try again.']);
    }
  }
  function renderResult(result) {
    var score = Math.max(0, Math.min(100, Number(result.score) || 0));
    var level = Object.prototype.hasOwnProperty.call(LABELS, result.level) ? result.level : 'low';
    var findings = Array.isArray(result.findings) ? result.findings : [];
    $('input-errors').hidden = true;
    $('empty-result').hidden = true;
    $('analysis-result').hidden = false;
    $('details-panel').hidden = false;
    $('analysis-result').dataset.level = level;
    $('score-ring').style.setProperty('--score', String(score));
    $('score-ring').style.setProperty('--score-color', COLORS[level]);
    $('score-ring').setAttribute('aria-valuenow', String(score));
    $('score-ring').setAttribute('aria-valuetext', score + ' out of 100. ' + LABELS[level] + '. Indicator score, not a probability.');
    $('score-value').textContent = score;
    $('concern-pill').textContent = LABELS[level];
    $('assessment-title').textContent = TITLES[level];
    $('result-kind').textContent = mode === 'url' ? 'URL analysis' : 'Email analysis';
    $('result-summary').textContent = result.summary || '';
    $('hostname-box').hidden = !result.hostname;
    $('hostname-value').textContent = result.hostname || '';
    $('findings-count').textContent = findings.length + (findings.length === 1 ? ' finding' : ' findings');
    var findingList = $('findings-list');
    findingList.replaceChildren();
    if (!findings.length) findingList.append(element('p', 'no-findings', 'No configured warning patterns were detected. This does not establish that the content is safe.'));
    findings.forEach(function (finding) {
      var row = element('article', 'finding');
      row.dataset.severity = finding.severity || 'info';
      var icon = element('span', 'finding-icon', finding.severity === 'info' ? 'i' : '!');
      icon.setAttribute('aria-hidden', 'true');
      var content = element('div');
      var heading = element('div', 'finding-title-line');
      heading.append(element('h4', '', finding.title || 'Warning indicator'));
      if (Number(finding.points) > 0) heading.append(element('span', 'finding-points', '+' + finding.points + ' pts'));
      content.append(heading, element('p', '', finding.detail || ''));
      if (finding.evidence) content.append(element('code', '', finding.evidence));
      row.append(icon, content);
      findingList.append(row);
    });
    var checksList = $('checks-list');
    checksList.replaceChildren();
    (result.checks || []).forEach(function (check) {
      var row = element('div', 'check-row');
      var checkStatus = check.status === 'warn' ? 'warn' : check.status === 'pass' ? 'pass' : 'info';
      var icon = element('span', 'check-status ' + checkStatus, checkStatus === 'pass' ? '✓' : checkStatus === 'warn' ? '!' : '·');
      icon.setAttribute('aria-hidden', 'true');
      var content = element('div');
      content.append(element('h3', '', check.label || 'Check'), element('p', '', check.detail || ''));
      row.append(icon, content);
      checksList.append(row);
    });
    var limitations = $('limitations-list');
    limitations.replaceChildren();
    (result.limitations || []).forEach(function (limitation) { limitations.append(element('li', '', limitation)); });
    $('result-announcement').textContent = LABELS[level] + '. Indicator score ' + score + ' out of 100. ' + (result.summary || '') + ' ' + findings.length + ' findings. Results follow the input form.';
  }
  function buildReport() {
    if (!currentResult) return '';
    var r = currentResult;
    var lines = ['PHISHGUARD — EXPLAINABLE PHISHING INDICATOR REPORT', 'Generated: ' + new Date().toISOString(), '', 'Type: ' + (r.kind === 'email' ? 'Email' : 'URL'), 'Assessment: ' + (LABELS[r.level] || r.level), 'Indicator score: ' + r.score + '/100 (not a probability)', 'Summary: ' + (r.summary || '')];
    if (demoLoaded) lines.push('Source: Built-in demonstration example');
    lines.push('', 'INPUT');
    if (typeof currentInput === 'string') lines.push(currentInput);
    else lines.push('Sender: ' + (currentInput.sender || '(not provided)'), 'Subject: ' + (currentInput.subject || '(not provided)'), 'Body:', currentInput.body || '');
    if (r.hostname) lines.push('', 'Destination hostname: ' + r.hostname);
    lines.push('', 'FINDINGS');
    if (!(r.findings || []).length) lines.push('No configured warning patterns detected. This does not prove safety.');
    (r.findings || []).forEach(function (f, index) {
      lines.push((index + 1) + '. ' + f.title + ' (+' + (f.points || 0) + ' points)', f.detail || '');
      if (f.evidence) lines.push('Evidence: ' + f.evidence);
      lines.push('');
    });
    lines.push('CHECKS');
    (r.checks || []).forEach(function (check) { lines.push('• ' + check.label + ': ' + check.detail); });
    lines.push('', 'LIMITATIONS', 'A low score does not establish that content is safe.');
    (r.limitations || []).forEach(function (limitation) { lines.push('• ' + limitation); });
    lines.push('', 'Analysis is browser-local. No submitted links were opened.');
    return lines.join('\n');
  }
  async function copyReport() {
    var report = buildReport();
    if (!report) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(report);
      else {
        var temporary = element('textarea');
        temporary.value = report;
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.append(temporary);
        temporary.focus();
        temporary.select();
        var copied = document.execCommand('copy');
        temporary.remove();
        $('copy-report').focus();
        if (!copied) throw new Error('Copy unavailable');
      }
      setStatus('Report copied to clipboard.');
    } catch { setStatus('Clipboard access unavailable. Use Download report instead.'); }
  }
  function downloadReport() {
    var report = buildReport();
    if (!report) return;
    var blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    var objectUrl = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'phishguard-report.txt';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
    setStatus('Report downloaded.');
  }
  document.querySelectorAll('[role="tab"]').forEach(function (tab) {
    tab.addEventListener('click', function () { selectMode(tab.dataset.mode, false); });
    tab.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selectMode(mode === 'url' ? 'email' : 'url', true); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectMode(event.key === 'Home' ? 'url' : 'email', true); }
    });
  });
  $('analyze-form').addEventListener('submit', function (event) { event.preventDefault(); analyze(); });
  $('analyze-form').addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); analyze(); }
  });
  $('analyze-form').addEventListener('input', function () {
    demoLoaded = false;
    $('demo-indicator').hidden = true;
    if (currentResult) { clearResult(); setStatus('Input changed. Analyze again for an updated result.'); }
    $('url-input').removeAttribute('aria-invalid');
    $('body-input').removeAttribute('aria-invalid');
    $('input-errors').hidden = true;
  });
  $('reset').addEventListener('click', function () {
    $('url-input').value = '';
    $('sender-input').value = '';
    $('subject-input').value = '';
    $('body-input').value = '';
    demoLoaded = false;
    $('demo-indicator').hidden = true;
    clearResult();
    $('url-input').removeAttribute('aria-invalid');
    $('body-input').removeAttribute('aria-invalid');
    (mode === 'url' ? $('url-input') : $('sender-input')).focus();
  });
  $('copy-report').addEventListener('click', copyReport);
  $('download-report').addEventListener('click', downloadReport);
  function setActiveSection(section) {
    document.querySelectorAll('.sidebar .nav-item[data-section]').forEach(function (link) {
      var active = link.dataset.section === section;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function revealApproach(focus) {
    var approach = $('approach');
    if (!approach) return;
    approach.open = true;
    setActiveSection('approach');
    approach.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (focus) approach.querySelector('summary').focus({ preventScroll: true });
  }
  document.querySelectorAll('.sidebar .nav-item[data-section]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var section = link.dataset.section;
      var target = $(section);
      if (!target) return;
      event.preventDefault();
      if (window.location.hash !== '#' + section) window.history.pushState(null, '', '#' + section);
      if (section === 'approach') revealApproach(true);
      else {
        setActiveSection('scanner');
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });
  window.addEventListener('hashchange', function () {
    if (window.location.hash === '#approach') revealApproach(false);
    else setActiveSection('scanner');
  });
  if (window.location.hash === '#approach') revealApproach(false);
  else setActiveSection('scanner');
  renderExamples();
}());
