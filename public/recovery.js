(() => {
  'use strict';
  const engine = window.PhishGuardRecovery;
  const byId = id => document.getElementById(id);
  const form = byId('recovery-form');
  const options = byId('scenario-options');
  const status = byId('recovery-status');
  const errors = byId('recovery-errors');
  const empty = byId('recovery-empty');
  const results = byId('recovery-results');
  const actionContainer = byId('plan-actions');
  let currentPlan = null;
  let completed = new Set();
  const simpleIds = new Set(['clicked', 'unsure']);
  const phaseNames = {now: 'Do this now', next: 'Check next', watch: 'Keep watch'};

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function safeLink(link) {
    const a = el('a', '', link.label);
    try {
      const url = new URL(link.url);
      if (url.protocol !== 'https:' && url.protocol !== 'tel:') return el('span', '', link.label);
      a.href = link.url;
      if (url.protocol === 'https:') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    } catch { return el('span', '', link.label); }
    return a;
  }
  function clearErrors() { errors.replaceChildren(); errors.hidden = true; }
  function invalidatePlan(announce = true) {
    const hadPlan = !!currentPlan;
    currentPlan = null;
    completed = new Set();
    results.hidden = true;
    empty.hidden = false;
    byId('manual-copy-area').hidden = true;
    byId('manual-plan-copy').value = '';
    clearErrors();
    if (announce && hadPlan) status.textContent = 'Answers changed. Build a new action plan to update your steps.';
  }
  function updateProgress() {
    const total = currentPlan ? currentPlan.actions.length : 0;
    byId('completion-count').textContent = `${completed.size} of ${total} steps marked done`;
  }
  function renderActions(plan) {
    actionContainer.replaceChildren();
    ['now', 'next', 'watch'].forEach((phase, index) => {
      const actions = plan.actions.filter(action => action.phase === phase);
      if (!actions.length) return;
      const group = el('section', 'action-phase');
      group.dataset.phase = phase;
      const heading = el('h3');
      heading.append(el('span', 'phase-number', String(index + 1)), document.createTextNode(phaseNames[phase]));
      group.append(heading);
      actions.forEach(action => {
        const row = el('div', 'plan-action');
        const label = el('label', 'action-check');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `action-${action.id}`;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) completed.add(action.id); else completed.delete(action.id);
          row.classList.toggle('is-complete', checkbox.checked);
          updateProgress();
        });
        const copy = el('span');
        copy.append(el('strong', '', action.title), el('small', '', action.detail));
        label.append(checkbox, copy);
        row.append(label);
        if (action.links && action.links.length) {
          const links = el('div', 'action-links');
          action.links.forEach(link => links.append(safeLink(link)));
          row.append(links);
        }
        group.append(row);
      });
      actionContainer.append(group);
    });
  }
  function renderPlan(plan) {
    currentPlan = plan;
    completed = new Set();
    byId('plan-title').textContent = plan.title;
    byId('plan-summary').textContent = plan.summary;
    byId('plan-priority').hidden = !plan.urgent;
    renderActions(plan);
    updateProgress();
    byId('plan-sources').replaceChildren();
    (plan.sources || []).forEach(source => {
      const li = el('li'); li.append(safeLink(source)); byId('plan-sources').append(li);
    });
    byId('plan-limitations').replaceChildren();
    (plan.limitations || []).forEach(text => byId('plan-limitations').append(el('li', '', text)));
    byId('manual-copy-area').hidden = true;
    results.hidden = false; empty.hidden = true;
    status.textContent = 'Your action plan is ready. Start with the steps under Do this now.';
    byId('plan-title').focus();
  }

  if (!engine || typeof engine.buildPlan !== 'function') {
    errors.hidden = false;
    errors.textContent = 'The checklist could not load. Reload this page and try again. If money or banking access is involved, contact your bank now using its official app or the number on your card.';
    byId('build-plan').disabled = true;
    return;
  }

  engine.scenarios.forEach((scenario, index) => {
    if (simpleIds.has(scenario.id) && index > 0 && !simpleIds.has(engine.scenarios[index - 1].id)) options.append(el('div', 'scenario-divider'));
    const label = el('label', `scenario-option${simpleIds.has(scenario.id) ? ' option-simple' : ''}`);
    const input = document.createElement('input');
    input.type = 'checkbox'; input.name = 'scenario'; input.value = scenario.id; input.id = `scenario-${scenario.id}`;
    const copy = el('span'); copy.append(el('strong', '', scenario.title), el('small', '', scenario.detail));
    label.append(input, copy);
    input.addEventListener('change', () => {
      if (input.checked) {
        options.querySelectorAll('input').forEach(other => {
          if (other === input) return;
          if (simpleIds.has(input.value) || simpleIds.has(other.value)) other.checked = false;
        });
      }
      invalidatePlan();
    });
    options.append(label);
  });

  byId('work-device').addEventListener('change', () => invalidatePlan());
  byId('reporting-region').addEventListener('change', () => invalidatePlan());
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors();
    const selected = [...options.querySelectorAll('input:checked')].map(input => input.value);
    const plan = engine.buildPlan({selected, workDevice: byId('work-device').checked, region: byId('reporting-region').value});
    if (!plan.valid) {
      invalidatePlan(false);
      errors.hidden = false;
      (plan.errors || ['Select at least one option so we can build your checklist.']).forEach(message => errors.append(el('p', '', message)));
      status.textContent = 'Select what happened to build your action plan.';
      const first = options.querySelector('input'); if (first) first.focus();
      return;
    }
    renderPlan(plan);
  });
  byId('reset-recovery').addEventListener('click', () => {
    form.reset(); invalidatePlan(false);
    status.textContent = 'Answers and checklist progress cleared.';
    const first = options.querySelector('input'); if (first) first.focus();
  });
  byId('edit-answers').addEventListener('click', () => {
    const firstChecked = options.querySelector('input:checked') || options.querySelector('input');
    if (firstChecked) firstChecked.focus();
    status.textContent = 'Update any answers, then build a new action plan.';
  });
  byId('copy-plan').addEventListener('click', async () => {
    if (!currentPlan) return;
    const text = engine.formatPlan(currentPlan);
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = 'Action plan copied. Paste it into a note to keep it handy.';
    } catch {
      byId('manual-copy-area').hidden = false;
      const field = byId('manual-plan-copy'); field.value = text; field.focus(); field.select();
      status.textContent = 'Clipboard access is unavailable. Your plan is selected below—copy it manually.';
    }
  });
  byId('download-plan').addEventListener('click', () => {
    if (!currentPlan) return;
    const blob = new Blob([engine.formatPlan(currentPlan)], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'phishguard-action-plan.txt'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Action plan download prepared. Keep it somewhere you can find it.';
  });
})();
