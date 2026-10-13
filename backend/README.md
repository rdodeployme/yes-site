# Yarta live backend

The tool (`/tool/`) and the client portal (`/portal/`) run on Firebase: invite-only sign-in by emailed link, data in Firestore, files in Cloud Storage. The front end is unchanged; `src/assets/yarta/yarta-live.js` loads what each person is allowed to see into the same state the prototype used, and writes changes back as narrow, rule-checked documents.

While `src/assets/yarta/live-config.js` holds `null`, nothing changes: the site, the demo, the tool and the portal run as the prototype on fictional data. The Readiness Check still works and offers to email the result.

## Who can see and do what

| | Yarta staff | A customer | Anyone else |
|---|---|---|---|
| Their own published dashboard, months and issued reports | ✓ all customers | ✓ own organisation only | ✗ |
| Drafts, months awaiting verification, analyst notes, evidence files | ✓ | ✗ | ✗ |
| Another customer's anything | ✓ | ✗ | ✗ |
| Enter or change a figure | ✓ (two people per month) | ✗ | ✗ |
| Send documents, declare "not reported" on an open month | ✓ | ✓ own organisation | ✗ |
| Request help (and cancel the request) | ✓ | ✓ own organisation | ✗ |
| Set targets, choose roadmap items | ✓ | ✓ own organisation | ✗ |
| Providers, outbox, gap emails, accounts, leads | ✓ | ✗ | ✗ |
| Invite a customer contact | ✓ | ✗ | ✗ |
| Invite Yarta staff, switch staff off | owner only | ✗ | ✗ |
| Submit a Readiness Check | — | — | ✓ create only, validated, cannot read back |

Integrity rules, enforced by the database for everyone including owners:

- **Four eyes.** The person who marks a month verified cannot be the person who entered it, and neither name can be forged.
- **Verified means frozen.** A verified month's figures and evidence cannot be edited; it must be reopened and verified again.
- **Customers see only what Yarta issued.** A month reaches the customer when its report is issued, and the published copy must match the verified figures exactly.
- **Issued reports are permanent.** Each issue writes a report record (`views/{org}/reports/{month}-r{n}`) that nobody can change or delete. A correction is a new issue.
- **The activity log is append-only.** Sent documents and sent invitations are never overwritten.

The rules: `firestore.rules`, `storage.rules`. The attack suite: `test/rules.test.mjs` (53 tests, every attack must fail).

## Switching it on (about 30 minutes, needs the Google account that will own it)

1. **Create the project.** console.firebase.google.com → Add project → name it `yarta` (or similar). Analytics off.
2. **Billing.** Upgrade to Blaze (pay as you go): Cloud Storage needs it for new projects. Set a budget alert (Google Cloud console → Billing → Budgets).
3. **Sign-in.** Authentication → Get started → Sign-in method → Email/Password → enable, and enable **Email link (passwordless sign-in)**. Settings → Authorised domains → add `rdodeployme.github.io` and `yes.com.au`.
4. **Database.** Firestore Database → Create database → Production mode → location **australia-southeast1 (Sydney)**. The location cannot be changed later.
5. **Files.** Storage → Get started → same location.
6. **Rules.** Paste `firestore.rules` into Firestore → Rules → Publish, and `storage.rules` into Storage → Rules → Publish. When Storage asks to let rules read Firestore (cross-service rules), allow it. Or, from this folder: `npx firebase deploy --only firestore:rules,storage --project <project-id>`.
7. **Downloads from the browser.** Google Cloud console → Cloud Shell: `gsutil cors set cors.json gs://<bucket>` (upload `cors.json` first). Without this, staff cannot open evidence files from the tool.
8. **Web app config.** Project settings → Your apps → Add app → Web → copy the config object into `src/assets/yarta/live-config.js` in place of `null`. It is not a secret; the rules protect the data.
9. **First owner.** Firestore → Start collection `invites` → document ID = the owner's email in lower case → fields:
   `email` (string, same email) · `name` (string) · `title` (string) · `role` (string `owner`) · `orgId` (null) · `invitedByUid` (string `console`) · `invitedBy` (string `Console`) · `invitedAt` (timestamp, now) · `expiresAt` (timestamp, within 30 days).
10. **Publish** the site (push to `main`), open `/tool/`, enter that email, open the link. Then invite the second analyst from **Team and access**: every month needs two people.

## Tests

```
cd backend && npm install
npm run test:rules          # 53 attack tests against the Firestore and Storage emulators
npm run build:live          # rebuild src/assets/yarta/yarta-live.js after editing live/yarta-live.src.js
```

End to end (Python Playwright, emulators running via `npm run emulators`, the site built with `YES_BASE_PATH="" python3 build.py` and served from `docs/` on port 8000):

```
python3 e2e/core.py                   # owner → second analyst → customer → document → entry → four eyes → verify → issue → customer sees it
python3 e2e/readiness.py              # Readiness Check → lead → Leads page → convert to customer
python3 e2e/prototype_regression.py   # with no backend, the prototype behaves as before
```

## Known limits (be straight with customers about these)

- **Email.** Firebase sends the sign-in links. Gap emails, report-issued notices and introductions still queue in the Outbox and go out from Outlook. Automating them needs a Cloud Function and a mail account.
- **Spam on the Readiness Check.** Submissions are validated field by field, but there is no CAPTCHA or App Check yet. Turn on App Check (reCAPTCHA Enterprise) before the council email goes out.
- **Two people editing the same month at once:** the later save wins. Fine for a small team; not for a large one.
- **No multi-factor sign-in yet** for staff. Firebase supports it with Identity Platform.
- **Data location.** The database and files sit in Sydney once created there. Sign-in accounts are held by Firebase Authentication; check where against any council that requires Australian-only hosting.
- **Not independently tested.** Before more than a couple of customers, have a developer review this folder and run a penetration test. Councils will send security questionnaires.
- **The front end** is still the prototype's single `portal.js`; this layer wraps it rather than rewriting it.
