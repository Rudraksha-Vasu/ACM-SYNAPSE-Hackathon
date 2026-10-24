/* PhishGuard: local, explainable heuristics. No network requests or ML model. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PhishGuard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_URL_LENGTH = 4096;
  var MAX_BODY_LENGTH = 50000;
  var MAX_LINKS = 20;
  var BRANDS = [
    { name: 'PayPal', token: 'paypal', domains: ['paypal.com', 'paypal.me'] },
    { name: 'Google', token: 'google', domains: ['google.com', 'google.co.in', 'google.co.uk', 'youtube.com'] },
    { name: 'Microsoft', token: 'microsoft', domains: ['microsoft.com', 'microsoftonline.com', 'live.com', 'outlook.com', 'office.com', 'office365.com', 'aka.ms'] },
    { name: 'Apple', token: 'apple', domains: ['apple.com', 'icloud.com'] },
    { name: 'Amazon', token: 'amazon', domains: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazonpay.in'] },
    { name: 'CampusBank', token: 'campusbank', domains: ['campusbank.example'] }
  ];
  var SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'shorturl.at', 'rb.gy'];
  var URL_LIMITATIONS = [
    'Local rule-based assessment; the score is not a probability or a verdict.',
    'The destination was not visited. Redirects, page content, domain ownership, and live threat-reputation feeds were not checked.',
    'No detected indicators does not establish that a link is safe. The brand reference list is deliberately small.'
  ];
  var EMAIL_LIMITATIONS = [
    'Local rule-based assessment; the score is not a probability or a verdict.',
    'Pasted text cannot authenticate the sender. SPF, DKIM, DMARC, attachments, and full message headers were not checked.',
    'Links were inspected as text, not visited. Redirects, website content, and live threat-reputation feeds were not checked.',
    'Legitimate messages can trigger these indicators, and phishing messages can avoid them. No detected indicators does not establish safety.'
  ];

  function levelFor(score) { return score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low'; }
  function clip(text, max) {
    text = String(text == null ? '' : text);
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
  function resultBase(kind) {
    return { kind: kind, valid: true, errors: [], score: 0, level: 'low', summary: '', findings: [], checks: [], urls: [], hostname: null, protocol: null, limitations: (kind === 'url' ? URL_LIMITATIONS : EMAIL_LIMITATIONS).slice() };
  }
  function invalid(kind, message) {
    var result = resultBase(kind);
    result.valid = false;
    result.errors = Array.isArray(message) ? message : [message];
    result.level = 'invalid';
    result.summary = 'Input needs attention before analysis.';
    return result;
  }
  function add(result, id, title, detail, evidence, points, severity) {
    if (result.findings.some(function (f) { return f.id === id; })) return;
    result.findings.push({ id: id, title: title, detail: detail, evidence: clip(evidence || '', 500), points: points, severity: severity || (points >= 25 ? 'danger' : points > 0 ? 'warning' : 'info') });
  }
  function finish(result) {
    result.score = Math.min(100, result.findings.reduce(function (sum, f) { return sum + f.points; }, 0));
    result.level = levelFor(result.score);
    var count = result.findings.filter(function (f) { return f.points > 0; }).length;
    if (result.level === 'high') result.summary = 'Several strong warning indicators were found. Verify independently before acting.';
    else if (result.level === 'medium') result.summary = 'Warning indicators were found. Check the destination and request independently.';
    else if (count) result.summary = 'A few warning indicators were found. A low score does not establish safety.';
    else result.summary = 'No warning indicators matched these local rules. This does not establish safety.';
    return result;
  }
  function check(result, label, status, detail) { result.checks.push({ label: label, status: status, detail: detail }); }
  function safeDecode(text) { try { return decodeURIComponent(text); } catch { return text; } }
  function canonicalHost(host) { return String(host || '').toLowerCase().replace(/\.$/, ''); }
  function isWithin(host, domain) { return host === domain || host.endsWith('.' + domain); }
  function ownBrand(host, brand) { return brand.domains.some(function (domain) { return isWithin(host, domain); }); }
  function isIP(host) { return /^\[(?:[0-9a-f:.]+)\]$/i.test(host) || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host); }
  function validHost(host) {
    if (isIP(host)) return true;
    if (host === 'localhost') return true;
    if (host.length > 253 || host.indexOf('.') < 0) return false;
    return host.split('.').every(function (label) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label); });
  }
  function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function namedBrands(text) {
    return BRANDS.filter(function (brand) { return new RegExp('\\b' + escapeRegex(brand.token) + '\\b', 'i').test(text); });
  }
  function oneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a === b) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (i < a.length || j < b.length ? 1 : 0) === 1;
  }

  function analyzeUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return invalid('url', 'Enter a website address.');
    if (raw.length > MAX_URL_LENGTH) return invalid('url', 'The address is too long. Use at most ' + MAX_URL_LENGTH + ' characters.');
    if (/[\u0000-\u001f\u007f]/.test(raw)) return invalid('url', 'The address contains control characters. Paste one URL on one line.');
    var input = raw.trim();
    if (/\s/.test(input)) return invalid('url', 'The address contains spaces. Paste one URL without surrounding text.');
    if (input.indexOf('\\') >= 0) return invalid('url', 'The address contains backslashes. Use a conventional HTTP or HTTPS URL.');
    var normalized = input;
    var inferred = false;
    if (/^https?:\/\//i.test(input)) {
      // Supported explicit scheme.
    } else if (/^\/\//.test(input)) {
      normalized = 'https:' + input;
      inferred = true;
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^[^/?#:@]+:\d+(?:[/?#]|$)/.test(input)) {
      return invalid('url', 'Use a complete HTTP or HTTPS website address. Other schemes are not supported.');
    } else {
      normalized = 'https://' + input;
      inferred = true;
    }
    var parsed;
    try { parsed = new URL(normalized); } catch { return invalid('url', 'This address could not be parsed. Check its hostname and port.'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return invalid('url', 'Only HTTP and HTTPS website addresses are supported.');
    var hostname = canonicalHost(parsed.hostname);
    if (!hostname || !validHost(hostname)) return invalid('url', 'Enter a valid hostname, such as example.com, or a valid IP address.');
    var result = resultBase('url');
    result.hostname = hostname;
    result.protocol = parsed.protocol.replace(':', '');
    check(result, 'Address format', 'pass', 'The address has a supported scheme and a parseable hostname. This is a format check, not a trust check.');
    if (inferred) check(result, 'Scheme assumption', 'info', 'No scheme was provided; HTTPS was assumed for parsing. The connection was not tested.');
    check(result, 'Destination hostname', 'info', hostname);

    if (parsed.username || parsed.password) {
      add(result, 'url.userinfo', 'Username embedded in the address', 'Text before @ is user information, not the destination. The destination hostname is ' + hostname + '.', safeDecode(parsed.username) + (parsed.password ? ':…' : '') + '@' + hostname, 25);
      check(result, 'Embedded username', 'warn', 'An address can place a familiar name before @ while opening a different hostname.');
    } else check(result, 'Embedded username', 'pass', 'No user information was found in the URL authority. An @ inside a path is not treated as user information.');

    if (parsed.protocol === 'http:') {
      add(result, 'url.http', 'Unencrypted HTTP address', 'This address requests HTTP rather than HTTPS. This is a connection warning, not proof of phishing.', 'http://', 10);
      check(result, 'Connection scheme', 'warn', 'HTTP does not request an encrypted HTTPS connection.');
    } else check(result, 'Connection scheme', 'info', 'HTTPS was requested. Encryption does not establish who operates the website.');

    if (isIP(hostname)) add(result, 'url.ip', 'IP address used as the destination', 'An IP address is less recognisable than an organisation domain. It may also be a legitimate local or technical service.', hostname, 15);
    if (parsed.port) add(result, 'url.port', 'Non-default web port', 'The address uses port ' + parsed.port + '. Alternative ports can be legitimate; check whether this is expected.', parsed.port, 5);
    if (hostname.split('.').some(function (label) { return label.indexOf('xn--') === 0; })) add(result, 'url.idn', 'Internationalised hostname', 'The hostname contains Punycode. Internationalised domains are legitimate in many languages, but lookalike characters deserve attention.', hostname, 10);
    if (SHORTENERS.some(function (host) { return isWithin(hostname, host); })) add(result, 'url.shortener', 'Shortened link hides its final destination', 'This appears to use a known shortening service. The final destination was not expanded or checked.', hostname, 10);

    var brandText = hostname + ' ' + safeDecode(parsed.username).toLowerCase();
    var impersonated = BRANDS.filter(function (brand) { return brandText.indexOf(brand.token) >= 0 && !ownBrand(hostname, brand); });
    var owned = BRANDS.filter(function (brand) { return ownBrand(hostname, brand); });
    if (impersonated.length) {
      var names = impersonated.map(function (brand) { return brand.name; }).join(', ');
      add(result, 'url.brand', 'Brand name appears outside its reference domains', 'The hostname or username mentions ' + names + ', but ' + hostname + ' is outside that brand’s small maintained reference list. This may indicate impersonation; the list is not exhaustive.', hostname + (parsed.username ? ' (username: ' + safeDecode(parsed.username) + ')' : ''), 40);
      check(result, 'Brand reference comparison', 'warn', 'Possible impersonation of ' + names + '. A brand name inside a longer hostname is not ownership evidence.');
    } else if (owned.length) {
      check(result, 'Brand reference comparison', 'info', 'The hostname matches a maintained ' + owned.map(function (b) { return b.name; }).join(', ') + ' reference domain boundary. This is not a guarantee about the page or message.');
    } else {
      check(result, 'Brand reference comparison', 'info', 'No exact brand-name conflict was found against the small reference list. Other brands are not covered.');
    }
    if (!impersonated.length && !owned.length && !isIP(hostname)) {
      var labels = hostname.split('.').slice(0, -1).reduce(function (all, label) { return all.concat(label.split('-')); }, []);
      var lookalikes = BRANDS.filter(function (brand) {
        if (brand.token.length < 5) return false;
        return labels.some(function (label) {
          if (label.length < 5 || label.indexOf('xn--') === 0) return false;
          var skeleton = label.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's');
          return skeleton === brand.token || oneEdit(label, brand.token);
        });
      });
      if (lookalikes.length) add(result, 'url.lookalike', 'Hostname resembles a known brand name', 'A hostname label closely resembles ' + lookalikes.map(function (b) { return b.name; }).join(', ') + ' but is not one of its maintained reference domains. Similarity alone does not prove impersonation.', hostname, 25);
    }
    if (input.length > 300) add(result, 'url.length', 'Long address may be difficult to inspect', 'Long tracking and application URLs are often legitimate. Inspect the destination hostname carefully.', input.length + ' characters', 5);
    if (hostname === 'localhost') check(result, 'Local destination', 'info', 'localhost refers to the current computer. No connection was attempted.');
    finish(result);
    result.urls = [{ input: input, hostname: hostname, score: result.score, level: result.level, findings: result.findings.slice() }];
    return result;
  }

  function decodeEntities(text) {
    return String(text || '').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, function (entity) {
      var named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
      if (named[entity.toLowerCase()] !== undefined) return named[entity.toLowerCase()];
      var number = entity.slice(2, -1), value = number.charAt(0).toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : parseInt(number, 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    });
  }
  function plainText(text) {
    return decodeEntities(String(text || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' '));
  }
  function sentences(text) { return text.match(/[^.!?\n]+[.!?]?/g) || [text]; }
  function negated(sentence, actionIndex) {
    var before = sentence.slice(Math.max(0, actionIndex - 90), actionIndex).toLowerCase();
    return /\b(?:never|do\s+not|don['’]?t|must\s+not|should\s+not|won['’]?t|will\s+never|avoid|beware\s+of)\b[^,;:]*$/.test(before);
  }
  function requestMatch(text, action, object) {
    var found = '';
    sentences(text).some(function (sentence) {
      var pattern = new RegExp('\\b(?:' + action + ')\\b[\\s\\S]{0,65}?\\b(?:' + object + ')\\b', 'ig');
      var match;
      while ((match = pattern.exec(sentence))) {
        if (!negated(sentence, match.index)) { found = match[0]; return true; }
      }
      return false;
    });
    return found;
  }
  function senderInfo(raw) {
    var text = String(raw || '').trim();
    if (!text) return null;
    var enclosed = text.match(/<([^<>]+)>\s*$/);
    var address = enclosed ? enclosed[1].trim() : text;
    var match = address.match(/^[^\s<>@]+@([^\s<>@]+)$/);
    if (!match) return false;
    var host;
    try { host = canonicalHost(new URL('https://' + match[1]).hostname); } catch { return false; }
    if (!validHost(host) || /[/:?#]/.test(match[1])) return false;
    return { address: address, hostname: host, display: enclosed ? text.slice(0, text.lastIndexOf('<')).trim() : '' };
  }
  function extractLinks(body) {
    var urls = [], anchors = [], seen = new Set();
    function append(value) {
      value = decodeEntities(value).trim();
      if (/^www\./i.test(value)) value = 'https://' + value;
      if (!/^https?:\/\//i.test(value)) return;
      var key = value;
      try { key = new URL(value).href; } catch { /* The analyzer will report invalid extracted links. */ }
      if (!seen.has(key)) { seen.add(key); urls.push(value); }
    }
    var anchorRe = /<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi, anchor;
    while ((anchor = anchorRe.exec(body))) {
      var href = anchor[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      if (!href) continue;
      var target = decodeEntities(href[1] || href[2] || href[3] || '');
      append(target);
      var visible = plainText(anchor[2]).trim();
      if (/^(?:https?:\/\/|www\.)/i.test(visible)) anchors.push({ visible: visible, target: target });
    }
    var rawLinks = body.match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];
    rawLinks.forEach(function (url) { append(url.replace(/[),.;!]+$/, '')); });
    return { all: urls, anchors: anchors };
  }

  function analyzeEmail(input) {
    input = input && typeof input === 'object' ? input : {};
    var body = typeof input.body === 'string' ? input.body : '';
    var subject = typeof input.subject === 'string' ? input.subject.trim() : '';
    var sender = typeof input.sender === 'string' ? input.sender.trim() : '';
    if (!body.trim() && !subject) return invalid('email', 'Paste an email body or enter a subject to analyze.');
    if (body.length > MAX_BODY_LENGTH) return invalid('email', 'The email body is too long. Use at most ' + MAX_BODY_LENGTH + ' characters.');
    if (subject.length > 500) return invalid('email', 'Use a subject with at most 500 characters.');
    if (sender.length > 500) return invalid('email', 'Use a sender field with at most 500 characters.');
    var parsedSender = senderInfo(sender);
    if (sender && !parsedSender) return invalid('email', 'The optional sender field could not be parsed. Use name@example.com or Name <name@example.com>, or leave it empty.');
    var result = resultBase('email');
    var text = subject + '\n' + plainText(body);
    var credential = requestMatch(text, 'enter|provide|submit|share|send|confirm|verify|type|disclose', 'password|passcode|otp|one[ -]time (?:password|passcode|code)|pin|login credentials|security code|card details|bank details|aadhaar|aadhar|pan number');
    if (credential) add(result, 'email.credentials', 'Request for sensitive information', 'The text appears to request credentials or other sensitive details. Verify the request independently. Ordinary mentions and negated advice are not counted by this rule.', credential, 30);
    var urgent = text.match(/\b(?:urgent(?:ly)?|immediately|act now|right now|within \d+ (?:minutes?|hours?)|in \d+ minutes?|final (?:warning|notice)|last chance)\b/i);
    var threat = text.match(/\b(?:account|access|service|subscription)[\s\S]{0,60}\b(?:block(?:ed)?|suspend(?:ed)?|clos(?:e|ed|ure)|deactivat(?:e|ed|ion)|terminat(?:e|ed|ion))\b/i);
    if (urgent && threat) add(result, 'email.pressure', 'Time pressure combined with an account threat', 'The message combines urgency with a threat to an account or service. This is a persuasion pattern, not proof of a scam.', clip(urgent[0] + ' · ' + threat[0], 220), 15);
    else if (urgent) add(result, 'email.urgency', 'Urgent wording', 'The message pressures the reader to act quickly. Legitimate messages can also be urgent, so this is a weak indicator on its own.', urgent[0], 8);
    else if (threat) add(result, 'email.threat', 'Threat involving an account or service', 'The message refers to losing account access. Legitimate service notices can use similar wording.', threat[0], 8);
    var payment = requestMatch(text, 'send|transfer|pay|purchase|buy|deposit|make', 'money|payment|funds|gift cards?|bitcoin|cryptocurrency|crypto|wire transfer');
    if (payment) add(result, 'email.payment', 'Request to make a payment or transfer', 'A financial action is requested. Invoices and legitimate services can also request payment; verify the recipient through a known channel.', payment, 15);

    var extracted = extractLinks(body);
    var analyzed = extracted.all.slice(0, MAX_LINKS).map(function (url) { return { input: url, result: analyzeUrl(url) }; });
    result.urls = analyzed.map(function (entry) { return { input: entry.input, hostname: entry.result.hostname, score: entry.result.score, level: entry.result.level, findings: entry.result.findings }; });
    if (extracted.all.length > MAX_LINKS) result.limitations.push('Only the first ' + MAX_LINKS + ' unique HTTP(S) links were checked; ' + extracted.all.length + ' were extracted.');
    var validLinks = analyzed.filter(function (entry) { return entry.result.valid; });
    analyzed.forEach(function (entry, index) {
      check(result, 'Link ' + (index + 1) + ' destination', entry.result.valid && entry.result.score >= 25 ? 'warn' : 'info',
        entry.result.valid ? entry.result.hostname + ' — ' + entry.result.level + ' concern, ' + entry.result.score + '/100 indicator points. No connection was made.' : 'The extracted address could not be parsed; inspect it manually.');
    });
    var highest = validLinks.reduce(function (current, entry) { return !current || entry.result.score > current.result.score ? entry : current; }, null);
    if (highest && highest.result.score > 0) {
      add(result, 'email.linkIndicators', 'Warning indicators in an included link', highest.result.findings.filter(function (finding) { return finding.points > 0; }).map(function (finding) { return finding.title; }).join('; ') + '. The strongest link contributes once, capped at 45 points.', highest.input, Math.min(45, highest.result.score));
    }
    var invalidLinks = analyzed.filter(function (entry) { return !entry.result.valid; });
    if (invalidLinks.length) check(result, 'Malformed extracted links', 'warn', invalidLinks.length + ' extracted link(s) could not be fully analyzed. Inspect them manually.');
    var mismatch = extracted.anchors.find(function (anchor) {
      var visible = analyzeUrl(anchor.visible), target = analyzeUrl(anchor.target);
      return visible.valid && target.valid && visible.hostname !== target.hostname;
    });
    if (mismatch) add(result, 'email.hiddenDestination', 'Displayed URL differs from the link destination', 'An HTML link shows one hostname but points to another. This can be a tracking link, but it can also conceal the actual destination.', 'Shown: ' + clip(mismatch.visible, 180) + ' | Target: ' + clip(mismatch.target, 180), 35);
    if (parsedSender) {
      check(result, 'Sender address', 'info', 'Claimed sender hostname: ' + parsedSender.hostname + '. This text was not authenticated.');
      var claimed = namedBrands(parsedSender.display + ' ' + subject + ' ' + plainText(body).slice(0, 200));
      var conflicts = claimed.filter(function (brand) { return !ownBrand(parsedSender.hostname, brand); });
      if (conflicts.length && (credential || payment || namedBrands(parsedSender.display).length)) add(result, 'email.senderBrand', 'Claimed brand and sender domain may not match', 'The message or display name mentions ' + conflicts.map(function (b) { return b.name; }).join(', ') + ', while the supplied sender is outside the maintained reference domains. Authorised third parties may use other domains; sender authenticity was not verified.', parsedSender.address, 20);
    } else check(result, 'Sender address', 'info', 'No sender address was supplied. Sender/domain comparisons were skipped.');
    check(result, 'Credential request wording', credential ? 'warn' : 'info', credential ? 'A request pattern involving sensitive details was found.' : 'No matching sensitive-detail request pattern was found. Wording-based checks can miss threats.');
    check(result, 'Included links', highest && highest.result.score > 0 ? 'warn' : 'info', analyzed.length + ' unique HTTP(S) link(s) inspected as text. The strongest link contributes once; repeats do not add points.');
    check(result, 'Sender authentication', 'info', 'Not available from pasted subject/body text. SPF, DKIM, and DMARC were not checked.');
    check(result, 'Attachments', 'info', 'Attachments were not inspected.');
    return finish(result);
  }

  return {
    analyzeUrl: analyzeUrl,
    analyzeEmail: analyzeEmail,
    version: '1.0.0',
    thresholds: { medium: 25, high: 60 },
    limits: { urlLength: MAX_URL_LENGTH, bodyLength: MAX_BODY_LENGTH, links: MAX_LINKS },
    brands: BRANDS.map(function (brand) { return { name: brand.name, domains: brand.domains.slice() }; })
  };
});
