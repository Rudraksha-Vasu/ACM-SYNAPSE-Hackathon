# PhishGuard — quick demo guide

## Two-minute walkthrough

**0–10 seconds — Problem and solution**

“PhishGuard helps people inspect suspicious links and incoming email messages. It explains the evidence behind its warning indicators. Email drafter helps prepare outgoing text, and Already clicked? gives next steps if someone has already interacted with suspicious content.”

**10–30 seconds — Deceptive URL**

Use the deceptive-address example:

```text
https://paypal.com@account-review.example/login
```

Point to the actual hostname, `account-review.example`. Explain that the text before `@` is user information, not the destination. Show the findings and their score contributions. This is a reserved demonstration address.

**30–50 seconds — Incoming email**

Open **Email message** and use the suspicious-email example. Show the combined credential request, pressure, and link findings. Briefly show an ordinary urgent example to explain why urgency alone is weak evidence.

**50–75 seconds — Review your writing**

Open **Email drafter** and load the example with mistakes. Show the before/after suggestions, then apply the corrections. Explain that advisory tips remain suggestions and the text remains editable.

For your own example, use:

```text
Hello team,

i am writting to ask when we will recieve the project update.

Thanks,
Parth
```

The supported rules can correct `i`, `writting`, and `recieve`. Recipient and subject can be added when useful; the message is required.

**75–90 seconds — Create and copy a draft**

Select **Create draft**. Inspect the final message, then demonstrate **Copy message** or **Copy full draft**. Explain that the user pastes the result into their chosen email app and sends it there. No email-account connection is needed for this workflow.

**90–120 seconds — Help after clicking**

Open **Already clicked?**. Select a realistic combination such as entering a password and sharing a one-time code. Build the plan and show how account-protection steps differ from the link-only case. Briefly show that payments and installed software lead to more urgent actions.

Explain: “We only ask what happened. We never ask for the actual password, OTP, or payment details. The checklist stays in this browser and does not scan or repair the device.”

For India, financial cyber fraud guidance includes contacting the bank immediately through a known official channel, calling **1930**, and using the official **cybercrime.gov.in** reporting portal. The location choice changes reporting guidance. A checklist is guidance, not a guarantee of safety or recovery.

Close with: “PhishGuard explains suspicious content, helps prepare clearer emails, and guides the next steps after an incident.”

## Four-person responsibilities

| Member | Build responsibility | Presentation topic |
| --- | --- | --- |
| 1 | Interface, navigation, and responsive layout | Problem, user experience, and How it works |
| 2 | URL parsing, domain rules, and scoring | Deceptive URL demonstration |
| 3 | Incoming-email rules and writing review | Email indicators and corrections |
| 4 | Integration, recovery guidance, draft copying, and tests | Already clicked? action plan and limitations |

Everyone should understand input → rules → findings → assessment, review → create draft → copy, and reported actions → recovery checklist. No actual secrets should be entered in a demonstration.

## Likely questions

**Is this machine learning?**

“The prototype uses transparent rules for phishing indicators and selected writing corrections. We have not trained a classifier or measured general detection accuracy.”

**What does a score of 80 mean?**

“The triggered rules contributed 80 indicator points under our scoring design. It is not an 80% probability of phishing.”

**Does low concern mean safe?**

“No. It means fewer configured indicators were found. It cannot rule out threats beyond those checks.”

**Why can HTTPS still be suspicious?**

“HTTPS encrypts communication with a domain. It does not establish that the domain belongs to the company the message claims to represent.”

**How do you know the sender is genuine?**

“We cannot establish that from pasted text. This version examines contents and links, not authenticated delivery information.”

**Does review automatically rewrite the message?**

“It proposes supported corrections and advisory tips. The user chooses whether to apply changes and can edit the text. Changes to the input invalidate the previous prepared draft.”

**Can PhishGuard send an email directly?**

“This version prepares a draft for the user to copy into their preferred email app. Sending happens in that app. PhishGuard does not need access to an email account.”

**What does Create draft do?**

“It captures the wording the user reviewed and opens a final preview. They can copy the message body, subject, or complete draft with its supplied headers.”

**Does Already clicked? know whether my device is infected?**

“No. It maps the actions the user reports to practical guidance from official sources. It cannot inspect the device or account. Completion does not establish that the incident is resolved.”

**Does it collect my password or OTP?**

“No. Users select only categories such as entered a password or shared a code. The questionnaire never asks for the values, and answers are not stored or sent.”

**How did you test it?**

“Automated checks cover important parsing, contextual detection, writing corrections, and input validation. We also check the review and copy workflow in a browser. We report actual results without inventing accuracy statistics.”

## Before presenting

- Open `public/index.html`, `public/email.html`, and `public/recovery.html` as offline fallbacks.
- Test navigation, both incoming-analysis tabs, correction review, and reset.
- Create a draft, verify the exact preview text, and test the copy controls.
- If clipboard permission is unavailable, demonstrate selecting and copying the final preview manually.
- Check a link-only plan, a combined password/code plan, and a payment or installed-app plan; verify changed answers require an updated plan.
- Use the live official reporting links when connected; the questionnaire itself works locally.
- Run `npm test` and report its actual outcome.
- Rehearse the implemented features and limitations in your own words. Follow the event’s restriction on AI use during the presentation.
