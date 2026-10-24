# PhishGuard Project Overview

## At a Glance

PhishGuard is a browser-first phishing-awareness prototype built for ACM SYNAPSE. It helps people inspect suspicious website addresses and incoming email, review an outgoing email draft, and choose next steps after a possible phishing interaction.

The project favors explainable rules: it shows which indicators matched instead of presenting a hidden model's judgment. It is a prototype, not a complete security product. A low score is not proof that a message or website is safe.

## What People Can Do

### Threat analyzer

- Analyze a website URL or pasted incoming email.
- See the parsed destination hostname, concern level, indicator score, findings, evidence, and checks performed.
- Inspect URL structure including embedded usernames before `@`, HTTP versus HTTPS, IP-address hosts, unusual ports, Punycode hostnames, known shorteners, and selected brand lookalikes.
- Check email text for requests involving passwords or other sensitive information, urgency and account threats, payment requests, suspicious links, mismatched displayed and actual link destinations, and some sender/brand conflicts.
- Copy or download an analysis report.

The analyzer does not open submitted links. Email links are examined as text and are never followed.

### Email drafter

- Review an outgoing subject and message using local rules for selected spelling mistakes, contractions, capitalization, and punctuation/spacing issues.
- Optionally select **Use online proofreading** to request additional suggestions from LanguageTool. This sends the subject and message, but not the recipient, to that service. The option is off by default. Do not submit confidential text.
- Inspect and choose whether to apply suggested changes; the app does not silently change the final draft.
- Preview and copy the message, subject, or complete draft into an email app. PhishGuard does not send email or connect to a mailbox.

The public LanguageTool API currently limits each request to 20,000 characters and provides suggestions for at most 30 misspelled words. Its availability and limits are not guaranteed. If online review fails, the local review remains available.

### Already clicked?

- Select categories describing what happened, such as opening a link, sharing a password or code, sending money, or installing software.
- Receive an action plan grouped by urgency, with guidance adjusted for reported payment, account, device, location, or work/school context.
- Copy or download the plan and use listed official resources.

The questionnaire asks about event categories, not the secret values. Answers and checklist progress are not stored or submitted. It cannot scan a device, secure an account, file a report, or guarantee recovery.

## Languages and Technologies

| Technology | What it is used for |
| --- | --- |
| HTML | Page structure for the Threat analyzer, Email drafter, and recovery guide. |
| CSS | Layout, responsive behavior, and visual styling. |
| JavaScript | Browser interactions, URL/email analysis rules, writing review, online proofreading requests, and recovery-plan logic. |
| TypeScript | Thin Next/Vinext app routes, layout metadata, and the Cloudflare Worker entry point. |
| React and Next.js | Framework/runtime layer used by Vinext to serve the app routes; the main tools are implemented as browser HTML and JavaScript pages. |
| Vite, Vinext, Wrangler, Cloudflare Workers | Local development, build, and hosting/runtime infrastructure. |
| SQL / SQLite with Drizzle | Database schema and migration tooling. The schema describes delivery-attempt metadata; the current prototype does not store draft content or questionnaire answers. |
| Node.js | Development scripts, automated tests, linting, and building. Node.js 22.13 or newer is specified. |
| CommonJS (`.cjs`) | Node's test-file format. The ESLint configuration permits `require()` only in these test files. |
| Python | Optional static-file server command for running the browser pages locally; Python is not used for the analyzer logic. |
| JSON and shell scripts | Project configuration and install/build support scripts. |

## How the Main Logic Works

### URL analysis

1. The input is checked for empty values, unsupported schemes, spaces, backslashes, control characters, and length limits.
2. A missing scheme is treated as HTTPS for parsing only; the app does not test a connection.
3. The browser URL parser identifies the actual hostname. This avoids treating a familiar-looking string before `@` as the destination.
4. Local rules compare the URL with a small set of known brand domains and URL patterns.
5. Matching rules add indicator points. The score is capped at 100; 0-24 is low concern, 25-59 medium concern, and 60-100 high concern.

### Incoming-email analysis

1. The app validates the optional sender, subject, and message size.
2. It examines plain text, or strips markup from HTML-like input before applying wording rules.
3. It looks for selected credential/payment requests and urgency or account-threat wording. Some explicitly negated requests are excluded.
4. It extracts and deduplicates HTTP(S) and `www.` links, then applies the URL checks to each link. Only the first 20 unique links are analyzed.
5. When HTML displays one URL but links to another, the mismatch is reported. Sender/domain comparisons are hints only; pasted text cannot prove who sent an email.

### Scores and findings

A score is the sum of configured rule points, capped at 100. It is an indicator score, not a probability of phishing, a confidence percentage, or a verdict. Each finding explains its rule and evidence so a person can check the result independently.

## Where the Code Lives

| Path | Purpose |
| --- | --- |
| `public/index.html`, `public/styles.css`, `public/app.js` | Threat analyzer interface, examples, result display, and report actions. |
| `public/engine.js` | Local URL parsing, phishing indicators, incoming-email analysis, and link extraction. |
| `public/email.html`, `public/email.css`, `public/email.js` | Email drafter form, review display, online opt-in, draft preview, and copy flow. |
| `public/reviewer.js` | Local writing rules and optional LanguageTool request/mapping. |
| `public/recovery.html`, `public/recovery.css`, `public/recovery.js` | Incident questionnaire and recovery-plan interface. |
| `public/recovery-engine.js` | Maps selected incident categories to local action plans. |
| `app/` | Thin framework routes and shared page metadata. Routes direct visitors to the browser pages in `public/`. |
| `worker/index.ts` | Cloudflare Worker entry point for the Vinext application. |
| `db/schema.ts`, `drizzle/`, `drizzle.config.ts` | Drizzle schema and SQLite migration configuration. |
| `tests/` | Node tests for URL/email rules, recovery plans, and Email drafter behavior. |
| `DEMO_GUIDE.md` | Walkthrough, team roles, likely questions, and pre-demo checklist. |

## Privacy and Boundaries

- URL analysis, incoming-email analysis, local writing checks, and recovery planning run in the browser.
- Links are not opened, and there is no live threat-reputation lookup.
- The only feature that sends draft text to a third party is online proofreading, and only after the user enables it and requests a review. It sends subject and body to LanguageTool, not the recipient.
- No password, one-time code, payment number, or suspicious URL is requested by the recovery questionnaire.
- The project has no trained phishing classifier and has not measured real-world detection accuracy.
- Sender authentication (SPF, DKIM, DMARC), full email headers, attachments, redirects, page content, and device state are not checked.
- The brand list and language rules are intentionally limited. A legitimate message can trigger a rule, and a phishing message can evade the configured checks.

## Run and Verify

Use Node.js 22.13 or newer for the framework development server:

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. To serve the static browser pages instead:

```bash
python -m http.server 8000 --directory public
```

Then open `http://localhost:8000/index.html`.

Project checks:

```bash
npm test
npm run lint
npm run build
```

At the time this overview was written, all 54 tests passed, `npm run lint` completed without warnings or errors, and `npm run build` completed successfully. The local test suite verifies important behavior; passing it does not establish real-world phishing detection accuracy.

## A Short Explanation for a Demo

“PhishGuard has three browser tools: it explains warning signs in a URL or incoming email, helps review and copy an outgoing email draft, and gives practical next steps after a suspicious interaction. Its checks are explainable rules, and it shows their limits. Online proofreading is a separate opt-in service; the threat analyzer itself does not visit links or query live reputation data.”
