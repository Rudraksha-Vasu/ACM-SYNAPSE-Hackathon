(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhishGuardRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Categorical answers only: never accept or retain credentials or message content.
  var scenarios = [
    { id: 'password', title: 'I entered a password', detail: 'Including a password you use on other accounts.' },
    { id: 'code', title: 'I shared an OTP or approved a sign-in', detail: 'A verification code, recovery code, or unexpected login prompt.' },
    { id: 'paymentDetails', title: 'I shared payment or banking details', detail: 'Card information, online banking login, or a UPI PIN.' },
    { id: 'moneySent', title: 'I sent money or noticed a payment', detail: 'A transfer, card charge, payment app, gift card, or crypto payment.' },
    { id: 'downloaded', title: 'I downloaded a file but did not open it', detail: 'A document, attachment, app installer, or other download.' },
    { id: 'installed', title: 'I opened a file or installed an app', detail: 'Including running a script, enabling macros, or adding an extension.' },
    { id: 'remote', title: 'I allowed screen sharing or remote access', detail: 'Someone could see your screen or control your device.' },
    { id: 'personal', title: 'I shared personal or identity information', detail: 'For example, an address, date of birth, or ID document.' },
    { id: 'clicked', title: 'I only opened the message or link', detail: 'No information shared, files opened, or permissions granted.' },
    { id: 'unsure', title: 'I am not sure what happened', detail: 'Start with a cautious account and device review.' }
  ];
  var sources = {
    phishing: { label: 'FTC · Phishing and next steps', url: 'https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams' },
    scam: { label: 'FTC · What to do if you were scammed', url: 'https://consumer.ftc.gov/articles/what-do-if-you-were-scammed' },
    account: { label: 'Google · Secure a compromised account', url: 'https://support.google.com/accounts/answer/6294825?hl=en' },
    ncsc: { label: 'NCSC · Recovering a hacked account', url: 'https://www.ncsc.gov.uk/guidance/recovering-a-hacked-account' },
    device: { label: 'Microsoft · Tech support scam recovery', url: 'https://support.microsoft.com/en-us/office/protect-yourself-from-tech-support-scams' },
    android: { label: 'Google · Remove unsafe Android software', url: 'https://support.google.com/accounts/answer/9924802?co=GENIE.Platform%3DAndroid&hl=en' },
    india: { label: 'I4C · Financial cyber fraud reporting', url: 'https://i4c.mha.gov.in/ncrp.aspx' },
    portal: { label: 'India · National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in/' }
  };
  var limitations = [
    'This checklist is based on your answers. It does not scan your device, access accounts, report an incident, or establish whether a compromise occurred.',
    'Completing the checklist cannot guarantee that an account or device is safe, or that money will be recovered. Follow your bank, account provider, or IT team’s instructions.',
    'Answers and ticked steps stay in this page’s memory and clear when it reloads. External help links open the named official website.'
  ];
  function invalid(errors) {
    return { valid: false, errors: errors, title: '', summary: '', urgent: false, selected: [], actions: [], sources: [], limitations: [] };
  }
  function buildPlan(input) {
    input = input || {};
    if (!Array.isArray(input.selected) || !input.selected.length) return invalid(['Select what happened, or choose “I am not sure”.']);
    var known = scenarios.map(function (item) { return item.id; });
    if (input.selected.some(function (id) { return typeof id !== 'string' || known.indexOf(id) === -1; })) return invalid(['Choose one of the listed situations.']);
    var selected = known.filter(function (id) { return input.selected.indexOf(id) !== -1; });
    if ((selected.indexOf('clicked') !== -1 || selected.indexOf('unsure') !== -1) && selected.length > 1) return invalid(['Choose “only opened” or “not sure” on its own, or select the specific things that happened.']);
    if (input.region !== undefined && input.region !== 'india' && input.region !== 'other') return invalid(['Choose a reporting location.']);
    if (input.workDevice !== undefined && typeof input.workDevice !== 'boolean') return invalid(['Choose whether this involves a work or school account or device.']);
    var has = function (id) { return selected.indexOf(id) !== -1; };
    var financial = has('paymentDetails') || has('moneySent');
    var account = has('password') || has('code');
    var device = has('installed') || has('remote');
    var india = input.region === 'india';
    var actions = [];
    var usedSources = ['phishing'];
    function add(id, phase, title, detail, keys) {
      keys = keys || [];
      actions.push({ id: id, phase: phase, title: title, detail: detail, links: keys.map(function (key) { return Object.assign({}, sources[key]); }) });
      keys.forEach(function (key) { if (usedSources.indexOf(key) === -1) usedSources.push(key); });
    }

    if (device) add('contain-device', 'now', has('remote') ? 'End remote access and disconnect the affected device' : 'Stop using the unfamiliar app or opened file', has('remote') ? 'End screen sharing or remote control. Disconnect the affected device from Wi-Fi, mobile data, and wired internet. Use a different trusted device to contact your bank or secure accounts.' : 'If an unfamiliar app is running or you suspect active compromise, disconnect this device from the internet. Use a different trusted device for account and banking recovery until the affected device has been checked.', ['device']);
    if (financial) add('contact-bank', 'now', 'Contact your bank or payment provider now', has('moneySent') ? 'Use the official app or the number on your card. Report the payment immediately and ask about stopping or reversing it, blocking affected access, and the provider’s dispute process. Keep transaction references; recovery is not guaranteed.' : 'Use the official app or the number on your card. Explain what you exposed and ask about blocking or replacing affected cards, changing banking credentials or PINs, and checking for payments you did not make.', ['scam']);
    if (has('code')) add('secure-code', 'now', 'Secure the account behind the code or approval', 'Use the real service’s security or account-recovery flow immediately. A code expiring does not undo access already approved. If it concerned banking or a payment, contact the bank or payment provider now using a known official channel.', ['account']);
    if (has('password')) add('change-password', 'now', 'Change the exposed and reused passwords', 'Open the real service independently on a trusted device. Set a unique password, then change it anywhere you reused it. If you cannot sign in, use the provider’s official recovery process. Prioritise your email account if its password was exposed.', ['scam', 'ncsc']);
    if (device && !has('password')) add('protect-device-accounts', 'now', 'Protect accounts used during the device exposure', 'From a different trusted device, change passwords for accounts you accessed while the unfamiliar software or remote session was active, especially email and banking. Change reused passwords too. Use official account recovery if locked out; do not type new passwords on the affected device.', ['device', 'ncsc']);
    add('stop-contact', 'now', 'Stop interacting with the message or caller', 'Close the suspicious page and end the conversation. Do not send more codes, approve prompts, pay, or install anything they request. Contact the real organisation using its known website or app, rather than details in the message.');
    if (input.workDevice) add('tell-it', 'now', 'Notify your work or school IT team', 'Use a trusted contact method. Tell them what happened and follow their response process before deleting evidence, uninstalling software, or resetting a managed device. Do not wait until you finish this checklist.', ['ncsc']);
    if (has('downloaded') && !device) add('do-not-open', 'now', 'Do not open or run the download', input.workDevice ? 'Do not open the file, enable macros, or follow an installer’s instructions. Let your IT team direct handling before deleting the file. If it opened automatically, ran, or received permissions, edit your answers and select “opened a file or installed an app”.' : 'Do not enable macros or follow an installer’s instructions. Remove the suspicious downloaded item. If it opened automatically, ran, or received permissions, edit your answers and select “opened a file or installed an app”.', ['phishing']);
    if (has('moneySent') && india) add('report-financial-india', 'now', 'In India, report financial cyber fraud on 1930', 'Call 1930 promptly, alongside contacting your bank. Complete the complaint at cybercrime.gov.in and retain the acknowledgement and payment references. PhishGuard does not submit the report for you.', ['india', 'portal']);
    if (account || device) {
      add('review-account', 'next', 'Review sessions, recovery details, and account access', 'Follow your provider’s instructions to sign out unfamiliar or other sessions. Check recent activity, recovery email/phone, connected apps, and, for email, forwarding rules. Remove changes or permissions you do not recognise.', ['account', 'ncsc']);
      add('secure-mfa', 'next', 'Secure your sign-in methods', 'Enable multi-factor authentication where available. Review enrolled authenticators and passkeys; remove unknown ones. Replace exposed recovery codes through the provider. Reject unexpected sign-in prompts and never share verification codes.', ['account']);
    }
    if (device) add('check-device', 'next', 'Get the affected device checked', input.workDevice ? 'Let your IT team direct removal and recovery. On a personal device, remove apps or extensions installed at the scammer’s request, update the system, and run its trusted security checks. For Android, review app permissions and Play Protect. Get official manufacturer help if unsure; a scan or uninstall does not prove the device clean.' : 'Remove apps or extensions installed at the scammer’s request, update the system, and run its trusted security checks. For Android, review app permissions and Play Protect. Get official manufacturer help if you cannot remove an app or the device behaves unexpectedly; a scan or uninstall does not prove it clean.', ['device', 'android']);
    if (has('personal')) add('protect-identity', 'next', 'Tell affected providers about the exposed information', 'Contact the relevant bank, mobile provider, or ID issuer through its official channel. Ask which protections apply to the document or details shared. Watch for accounts or requests made in your name; report suspected misuse to local authorities.', ['scam']);
    if (has('clicked') || has('unsure') || (has('downloaded') && !device)) add('review-device', 'next', 'Review what changed on your device', 'Check recent downloads, installed apps, extensions, and permissions. Keep the browser and operating system updated. If you suspect a harmful download, update and run trusted security software. A click alone does not establish compromise or safety; edit your answers if you find more happened.', ['phishing']);
    if (has('unsure')) add('review-uncertain-account', 'next', 'Check real accounts for unfamiliar activity', 'Open the account’s official app or website on a trusted device. Review sign-ins and security changes. If you find an exposed password, shared code, payment, or installed app, update your answers for the relevant recovery steps.', ['account']);
    add('save-report', 'next', 'Keep useful evidence, then report and block', 'Save sender details, screenshots, times, and transaction references without revisiting the suspicious site. Keep passwords, codes, and full payment details private. Use your email app’s phishing-report option and block the sender; follow your IT team’s evidence instructions if relevant.', india ? ['portal'] : []);
    if (has('moneySent') && !india) add('report-financial-local', 'next', 'Use your local fraud-reporting service', 'Ask your bank which official police or cybercrime reporting service applies in your country. Do this promptly and keep the report reference. The 1930 helpline and Indian portal are for incidents reported in India.', ['scam']);
    add('watch-activity', 'watch', financial ? 'Watch statements and account alerts' : 'Watch for unexpected account activity', financial ? 'Review payments and statements in the real bank or payment app. Report unfamiliar transactions immediately. Keep checking relevant email and account security alerts.' : 'Review security alerts and sign-ins through the real service. If contacts receive messages from your account, warn them through a separate trusted channel and follow account recovery steps.', account || device ? ['ncsc'] : []);
    add('avoid-followup', 'watch', 'Be cautious of follow-up and recovery scams', 'Ignore people demanding fees, codes, remote access, or another payment to “recover” money or fix the incident. Verify new approaches independently. Use unique passwords and multi-factor authentication to reduce future risk.', ['scam']);

    return {
      valid: true, errors: [],
      title: financial || account || device ? 'Start with the actions below.' : 'Take the next step, calmly.',
      summary: 'Based on what you selected, start with “Now”, then work through the remaining steps. Tick items only after you have done them.',
      urgent: financial || account || device,
      selected: selected.slice(),
      actions: actions,
      sources: usedSources.map(function (key) { return Object.assign({}, sources[key]); }),
      limitations: limitations.slice()
    };
  }
  function formatPlan(plan) {
    if (!plan || !plan.valid) return '';
    var lines = ['PhishGuard — Already clicked? Action plan', '', plan.title, plan.summary, '', 'Selected situations:'];
    scenarios.forEach(function (s) { if (plan.selected.indexOf(s.id) !== -1) lines.push('- ' + s.title); });
    ['now', 'next', 'watch'].forEach(function (phase) {
      var group = plan.actions.filter(function (a) { return a.phase === phase; });
      if (!group.length) return;
      lines.push('', phase === 'now' ? 'NOW' : phase === 'next' ? 'NEXT' : 'KEEP WATCH');
      group.forEach(function (a, i) {
        lines.push((i + 1) + '. ' + a.title, a.detail);
        a.links.forEach(function (link) { lines.push(link.label + ': ' + link.url); });
        lines.push('');
      });
    });
    lines.push('Keep in mind');
    plan.limitations.forEach(function (item) { lines.push('- ' + item); });
    return lines.join('\n').trim();
  }
  return { scenarios: scenarios, buildPlan: buildPlan, formatPlan: formatPlan };
});
