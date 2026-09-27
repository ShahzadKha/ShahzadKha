# Recruitment System

A dashboard app that turns incoming CVs into training sales:
**CV → AI analysis → email nurturing → SDR closing → payment → onboarding**.

It replaces the Activepieces + aitable.ai workflow from the client's diagram with one application,
while keeping the same steps, statuses and routing rules.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Foundation: login and roles, database, demo data, candidate list and profile with timeline, dashboard overview | ✅ Done |
| 2 | AI engine: CV import (PDF/Word/text), public web form, intake API, deduplication, OpenAI analysis with demo mode, scoring and routing rules, Settings | ✅ Done |
| 3 | Nurturing: email sequences per track, sending (simulated or SMTP), open/click/reply tracking, candidate offer page, unsubscribe, Purchase Ready detection, pipeline board | ✅ Done |
| 4 | Closing: automatic SDR handoff, SDR workspace and call sheet with script, payment link (ThriveCart or demo checkout), ThriveCart webhook, onboarding emails, NPS/testimonial page, notifications | ✅ Done |
| 5 | Dashboard (funnel, KPIs, sources, SDRs, revenue, NPS), user management, password change, CSV export, GDPR deletion, login protection, mobile menu, Vercel deployment, demo script | ✅ Done |

| 6 | Completeness review against the diagram: inbox reading (CVs by email + candidate replies), CSV import, Acumbamail sync, recycling, referral leads, SDR email alerts, platform link, candidate editing, bulk actions, Integrations page, embeddable form with partner tracking | ✅ Done |

**Presenting to the client?** Follow [DEMO_SCRIPT.md](DEMO_SCRIPT.md), a 15-minute walkthrough of the whole journey.

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript) + **Tailwind CSS 4**
- **PostgreSQL** with **Prisma 7**
- Login with email and password, and a signed session cookie (`jose`, `bcryptjs`)
- French interface with an English switch (the FR / EN button at the top right)

## Run it on your computer (Windows, macOS or Linux)

You need **Node.js 20+** and a **PostgreSQL** database.
The easiest way to get PostgreSQL is **Docker Desktop**.

```bash
# 1. Go into the project folder
cd "Recruitment System"

# 2. Start PostgreSQL (needs Docker Desktop running)
docker compose up -d

# 3. Create your settings file (it also holds the optional OpenAI key)
#    Windows (Command Prompt): copy .env.example .env
#    macOS / Linux:            cp .env.example .env
#    Then open .env and replace AUTH_SECRET with a long random text.

# 4. Install packages, create the tables and load the demo data
npm install
npm run db:setup

# 5. Start the app
npm run dev
```

Open http://localhost:3000 and sign in with a demo account.
The password for every demo account is `demo1234`.

| Email | Role |
|-------|------|
| admin@demo.local | Administrator (sees everything, including Users) |
| camille@demo.local | SDR |
| yanis@demo.local | SDR |
| recruteur@demo.local | Recruiter |

`npm run db:seed` resets the demo data at any time. The demo candidates come with realistic email
histories (sent, opened, clicked, replied) and sequences in progress.

## Put it online (Vercel + Neon, free tiers)

1. **Database**: create a free project on [neon.tech](https://neon.tech). In *Connect*, copy two
   connection strings: the **pooled** one (host contains `-pooler`) and the **direct** one
   (toggle "Connection pooling" off). Both look like `postgresql://user:password@ep-…neon.tech/neondb?sslmode=require`.
2. **App**: on [vercel.com](https://vercel.com), choose *Add New → Project* and import the GitHub repository.
   - **Root Directory**: `Recruitment System`
   - **Build Command**: `npm run vercel-build` (it applies the database migrations, then builds)
   - **Environment variables**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | the Neon **pooled** connection string (used by the app) |
   | `DIRECT_URL` | the Neon **direct** connection string (used for migrations) |
   | `AUTH_SECRET` | a long random text (32+ characters) |
   | `APP_URL` | the Vercel address, e.g. `https://recruitment-demo.vercel.app` |
   | `CRON_SECRET` | a random text (protects the daily email job) |
   | `SHOW_DEMO_LOGINS` | `true` only while showing demo data; leave it off once real data is in |
   | `INTAKE_API_KEY` | optional, turns on the import API |
   | `OPENAI_API_KEY`, `OPENAI_MODEL` | optional, real AI analysis |
   | `SMTP_URL`, `EMAIL_FROM` | optional, real email sending |
   | `THRIVECART_SECRET` | optional, ThriveCart payments |
   | `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` | optional, read CVs and replies from a mailbox |
   | `ACUMBAMAIL_AUTH_TOKEN`, `ACUMBAMAIL_LIST_ID` | optional, sync contacts to Acumbamail |

3. **Demo data**: from your computer, load the demo candidates into the online database once.
   This **deletes everything** in that database first, so never run it on real data:

   ```bash
   # Windows (Command Prompt) — use the DIRECT connection string here
   set DATABASE_URL=postgresql://…neon.tech/neondb?sslmode=require
   npm run db:seed
   ```

4. **Before real use**: remove `SHOW_DEMO_LOGINS`, change the demo passwords (Utilisateurs page)
   or create real users and deactivate the demo accounts, and reset the database to an empty one
   (or delete the demo candidates) before real candidates arrive.

`vercel.json` schedules the email job every morning (the free Vercel plan allows one run a day).

## AI analysis: demo mode or OpenAI

- **Without an OpenAI key** (default), CVs are analysed by a rule-based "demo mode": it matches the
  CV against each training's keywords and gives repeatable scores. The app labels these analyses
  "Analyse simulée (mode démo)".
- **With a key**, add these lines to `.env` and restart the app. Each CV is then sent to OpenAI,
  which returns structured JSON (profile, persona, skill gap, summary, scores, recommended training).

```
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5-mini"   # optional, this is the default
```

If an OpenAI call fails, the candidate shows "L'analyse a échoué" with the error and a
"Relancer l'analyse" button. Nothing is lost.

## How CVs come in (the diagram's 5 sources)

| Source | How to use it |
|--------|---------------|
| Incoming email | The **mailbox** is read automatically (IMAP): an email with a CV attached creates the candidate. If the CV has no email address, the sender's is used |
| Web form (landing page) | Public page at **`/apply`**, no login. Candidate fills in details, uploads a CV and gives GDPR consent. `?ref=skillhubs` records where they came from; `?embed=1` gives a compact version to put in an `<iframe>` on the landing page |
| CV drop | **Candidats → Importer des CV**: drag and drop several PDF, Word (.docx) or text files |
| Partner / job board file | Same page, **Importer un fichier CSV**: one row per candidate (template provided), with the partner name |
| Manual entry | **Candidats → Ajouter un candidat** |
| Automations (email inbox, job boards, Activepieces, n8n…) | **`POST /api/intake`**, see below |

Every CV goes through the same steps: text extraction → contact details (email, phone, LinkedIn) →
**duplicate check** (same email, or same phone number: the existing record is updated) → AI analysis →
eligibility → recommended training → **follow-up track** from the global score.

### Intake API

Set `INTAKE_API_KEY` in `.env` to turn it on, then:

```bash
# Send a CV file
curl -X POST https://your-app/api/intake \
  -H "Authorization: Bearer $INTAKE_API_KEY" \
  -F "file=@CV_Sarah_Benali.pdf" -F "source=EMAIL"

# Or send the text directly (JSON)
curl -X POST https://your-app/api/intake \
  -H "Authorization: Bearer $INTAKE_API_KEY" -H "Content-Type: application/json" \
  -d '{"source":"CSV_IMPORT","firstName":"Omar","lastName":"Diallo","email":"omar@example.com","cvText":"..."}'
```

`source` is one of `EMAIL`, `WEB_FORM`, `CSV_IMPORT`, `FILE_DROP`, `MANUAL` (default `CSV_IMPORT`).
The API answers `201 {"candidateId", "duplicate": false}`, or `200` when an existing candidate was
updated. Errors are `401` (bad key), `422` (for example `no_email`) and `503` (API disabled).

### Sample CVs for demos

`samples/` holds fictional CVs to drag into **Importer des CV**:

| File | Expected result |
|------|-----------------|
| `CV_Thomas_Girard.pdf` | Cybersecurity, high score |
| `CV_Sarah_Benali.pdf` | Data Analyst |
| `CV_Lea_Martin.pdf` | Digital Marketing |
| `CV_Julien_Petit.docx` | Full-Stack Web Developer (Word file) |
| `CV_Karim_Haddad.pdf` | Not eligible (chef, no matching training) |
| `CV_Sarah_Benali_mise_a_jour.txt` | Same email as Sarah → **duplicate**, record updated |

## Email nurturing (steps 10–18)

When the AI finds a candidate eligible, they start the **email sequence of their follow-up track**
and receive email 1 right away. The next emails go out on their day (the conversion sequence follows
the diagram: days 0, 3, 6, 9, 13, 17). Admins edit every sequence on **Séquences email**.

What the candidate does moves them through the pipeline automatically:

| Candidate action | Result |
|------------------|--------|
| Opens an email or clicks its link | `ENGAGED` |
| An email containing the offer is sent | `OFFER_SENT` |
| Replies "interested" | Sequence stops, `INTEREST_CONFIRMED`, the personalised offer email is sent |
| Replies "not interested" / unsubscribes | Sequence stops, `LOST` (no more emails) |
| Opens their **offer page** (`/offre/…`, shows the price) | `PRICE_VIEWED` |
| Asks to be called back and picks a start date | Interest and timing recorded |
| All 4 conditions met (fit, interest, price viewed, timing) | `PURCHASE_READY`, sequence stops (ready for an SDR) |
| Sequence ends with no interest | `NURTURE` (recycled) |

**Real replies**: when the mailbox is connected, candidates' replies are read and classified
(OpenAI if configured, otherwise keywords): *interested* → offer email; *not interested* → lost;
*STOP / unsubscribe* → unsubscribed. A reply from a candidate who is already with an SDR is logged
and the SDR is notified, without changing their status. The quoted email below the reply is removed.

**Recycling**: candidates who finish a sequence without buying (`NURTURE`) get the educational
sequence again after 30 days, once (both editable in Séquences email → options).

**For demos**, every candidate profile has "Simuler une action du candidat" buttons (opens, clicks,
replies, unsubscribes) and "Envoyer l'email suivant maintenant". The **Séquences email** page has
"Simuler +1 jour / +7 jours" to fast-forward time. Team members who open an offer page see a
preview banner, and their visits are not counted.

**Sending real emails**: by default emails are *simulated* (saved and visible in the app, not sent).
To send them for real through any SMTP provider (Acumbamail, Brevo, Mailjet, Amazon SES…), add to `.env`:

```
APP_URL="https://your-app.example.com"   # used in the links inside emails
SMTP_URL="smtp://user:password@smtp.provider.com:587"
EMAIL_FROM="contact@your-domain.com"
```

Emails are sent by a daily scheduler: `vercel.json` calls `/api/cron/sequences` every morning on
Vercel (set `CRON_SECRET`). The "Envoyer les emails prévus" button does the same on demand.

## Closing and after the sale (steps 19–26)

1. **Handoff (19)**: when a candidate meets the 4 Purchase Ready conditions, they are assigned to the
   least busy SDR, who gets a call task (due within 24 h, editable) and a notification (bell in the header).
   Admins and recruiters can also assign or reassign from the candidate profile.
2. **Call (20–21)**: **Espace SDR** lists each SDR's calls, most urgent first (overdue in red), with
   click-to-call. The **call sheet** shows the candidate brief (training, score, timing, AI summary,
   last reply), the **call script** (editable in Settings) and the result form:
   - ready to enrol → the **payment link** email is sent (`CALL_COMPLETED`)
   - no answer → a callback task is scheduled
   - not now → back to nurture
   - not interested → lost, with a reason
3. **Payment (22–23)**: the payment link opens `/paiement/…`. If the training has a **ThriveCart
   checkout link** (Settings → catalogue), the candidate goes to ThriveCart with their email, name and
   id pre-filled. Otherwise a **demo checkout** is shown. It never asks for card details.
   Payment confirmed → `WON`, the SDR is notified.
4. **After the sale (24–26)**: the onboarding sequence starts: welcome email right away, CV/LinkedIn
   coaching at day 60, and a request for feedback at day 90 linking to `/avis/…` (NPS 0–10,
   testimonial with publishing consent, referral of a friend).

### ThriveCart

In ThriveCart, add a webhook to `https://your-app/api/webhooks/thrivecart` and put the same secret in
`THRIVECART_SECRET`. On `order.success` the app finds the candidate (id passed through the checkout
link, or email), records the payment once per order, and moves them to `WON`. Amounts are read from
`order[total]` in cents. **Check this with one real test order**, since it was built from ThriveCart's
webhook format but not tested against a live ThriveCart account.

## Integrations page (admin)

**Intégrations** shows every connection with its status and a test button: OpenAI, email sending
(SMTP), the mailbox (IMAP, with the last emails read), Acumbamail, ThriveCart (webhook address),
the import API, the candidate form (direct link and `<iframe>` code) and the scheduler.

**Acumbamail (step 10)**: with `ACUMBAMAIL_AUTH_TOKEN` and `ACUMBAMAIL_LIST_ID`, each candidate is
added to / updated in the Acumbamail list whenever their status changes, with the custom fields
`prenom`, `nom`, `statut`, `score`, `formation`, `parcours` (create them in the list). Built from
Acumbamail's API documentation: check it once with the client's account.

## Working with candidates

- **Edit a record** (profile → *Modifier la fiche*): contact details, job title, start date,
  partner, and the **recommended training** (e.g. the candidate prefers another course).
- **Bulk actions** on the candidate list: tick candidates, then run the AI analysis, start the
  email sequence, assign an SDR, change the status, or delete (admin).
- **Referrals (step 26)**: a friend recommended on the feedback page becomes a new lead
  (source *Recommandation*), and admins and recruiters are notified to contact them. They are not
  emailed automatically, since they did not give consent themselves.
- **SDR alerts (step 19)**: a new call is also emailed to the SDR when real email sending is on.
- **Platform access (step 24)**: set the training platform link on each training (Settings →
  catalogue); the welcome email includes it as a button.

## Pipeline board

**Pipeline** shows one column per status. Drag a card to another column to change the candidate's
status, which is saved and logged in their timeline. Filters: follow-up track, SDR, and show or hide
won, lost and not-eligible candidates. The status can also be changed from the candidate profile.

## Settings (admin)

**Paramètres** lets an admin change, without touching code:
- the brand name and tagline (white-label)
- the score weights, the minimum fit for eligibility, the thresholds of the 5 follow-up tracks and the "Purchase Ready" conditions
- the training catalogue: name, price, description, and the keywords that tell the AI which profiles fit

## Dashboard and administration

- **Tableau de bord**: new candidates, eligibility rate, average AI score, purchase-ready, sales,
  revenue, conversion, NPS; the **conversion funnel** (CV received → won, with the % kept at each
  step); email open/click/reply rates; new CVs per week; revenue per training; performance per
  source and per SDR. Period: 7, 30, 90 days or everything.
- **Utilisateurs** (admin): add users with a temporary password, change roles, reset passwords,
  deactivate accounts (their open calls are released). The last active admin cannot be removed.
- **Mon compte**: anyone can change their own password (click your name in the sidebar).
- **Export (CSV)** on the candidate list, with the current filters (opens in Excel).
- **GDPR deletion**: admins can delete a candidate with their CV, emails, calls, payments and history.

## Security

- Passwords are hashed (bcrypt). Sessions are signed cookies (`AUTH_SECRET`), HTTP-only.
- After 5 wrong passwords for an email (or 20 from one IP) in 15 minutes, logins are blocked for 15 minutes.
- Roles: SDRs only see their own calls and cannot open settings, sequences, users or exports.
- Public links (offer, payment, feedback, unsubscribe) use random, unguessable tokens.
  Unsubscribing needs a button click, so email scanners cannot trigger it.
- Webhooks and APIs check their secret keys. The ThriveCart secret is never stored.
- Uploaded CVs are stored with the type the app detected, and Word and text files download
  instead of opening, so a disguised file cannot run in the browser.
- CSV exports neutralise spreadsheet formulas. Security headers are set on every page.

## Useful commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app in development mode |
| `npm run build` then `npm start` | Production build and server |
| `npm run lint` | Check the code style |
| `npm run typecheck` | Check TypeScript types |
| `npm run db:setup` | Apply database migrations and load the demo data |
| `npm run db:seed` | Reset the demo data |
| `npx prisma studio` | Browse the database in the browser |
| `npm run vercel-build` | What Vercel runs: migrations, then build |

## Project structure

```
prisma/
  schema.prisma      Data model (users, products, candidates, timeline events, settings)
  seed.ts            Demo data generator (fake people, example.com emails)
  migrations/        Database migrations
src/
  app/
    login/           Login page
    (app)/           Pages behind the login: dashboard, candidates, users, upcoming modules
    apply/           Public candidate web form
    offre/           Candidate's personalised offer page (public link from emails)
    desinscription/  Unsubscribe page
    api/t/           Email open and click tracking
    api/cron/        Daily scheduler that sends due emails
    api/webhooks/    ThriveCart payment webhook
    (app)/integrations/  Integrations page (status and tests)
    paiement/        Payment link page (ThriveCart redirect or demo checkout)
    avis/            NPS, testimonial and referral page
    (app)/sdr/       SDR workspace and call sheet
    api/intake/      Intake API for automated sources
    actions/         Server actions (login, language, candidates, CV import, settings)
  components/        Shared UI (sidebar, badges, timeline, charts)
  lib/
    analytics.ts     Dashboard numbers (funnel, sources, SDRs, revenue, NPS)
    candidate-filters.ts  Candidate search and filters (list page and CSV export)
    engine/          CV processing: text extraction, contact parsing, OpenAI and demo analysis, pipeline
    nurture/         Email sequences: default templates, rendering, sending, engagement rules
    closing/         SDR handoff, call results, payment, onboarding, feedback, referrals
    inbound/         Mailbox reading (IMAP) and reply classification
    integrations/    Acumbamail contact sync
    csv.ts           CSV reader for the partner import
    rules.ts         Scoring, eligibility, follow-up tracks and "Purchase Ready" rules
    pipeline.ts      Pipeline statuses and phases
    i18n/            French and English texts
    auth.ts          Current user and role checks
    session.ts       Session cookie signing
  proxy.ts           Redirects visitors who are not logged in to /login
```

## How it maps to the client's diagram

- **Statuses** follow the diagram legend exactly: `NEW_CV → CV_PARSED → GPT_ANALYZED → NOT_ELIGIBLE / PRODUCT_MATCHED → EMAIL_1_SENT → ENGAGED → INTEREST_CONFIRMED → OFFER_SENT → PRICE_VIEWED → PURCHASE_READY → SDR_ASSIGNED → CALL_COMPLETED → WON / LOST / NURTURE`.
- **Sources** are the five triggers: incoming email, web form, CSV/API import, CV drop and manual entry.
- **Follow-up tracks** follow the routing rules: below 50 educational nurturing, 50–64 light nurturing,
  65–79 conversion sequence, 80–89 call invitation, 90–100 priority SDR handoff (editable in Settings).
- **Purchase Ready** uses the four conditions: fit ≥ 70 and eligible, explicit interest, price viewed, and timing within 30 days.
- **Deduplication (step 4)**: a CV whose email or phone number already exists updates that record and logs "Doublon détecté" in the timeline.
- **AI analysis (steps 6–9)**: scores, persona, skill gap, summary, eligibility and the recommended training.
- **Timeline**: every step (CV parsed, AI analysis, emails, replies, SDR call, payment) is saved as an event on the candidate.
- **White-label**: the brand name ("Skilltec") is stored in the `Setting` table, not in the code.

All demo data is generated. It contains no real people's personal data.
