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
| 4 | Closing: SDR workspace, call logging, simulated ThriveCart payment, onboarding | ⏳ Next |
| 5 | Dashboard and polish: funnel charts, KPIs, settings screens, demo script | |

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
| Web form (landing page) | Public page at **`/apply`**, no login. Candidate fills in details, uploads a CV and gives GDPR consent |
| CV drop / email / partner import | **Candidats → Importer des CV**: drag and drop several PDF, Word (.docx) or text files |
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

## Pipeline board

**Pipeline** shows one column per status. Drag a card to another column to change the candidate's
status, which is saved and logged in their timeline. Filters: follow-up track, SDR, and show or hide
won, lost and not-eligible candidates. The status can also be changed from the candidate profile.

## Settings (admin)

**Paramètres** lets an admin change, without touching code:
- the brand name and tagline (white-label)
- the score weights, the minimum fit for eligibility, the thresholds of the 5 follow-up tracks and the "Purchase Ready" conditions
- the training catalogue: name, price, description, and the keywords that tell the AI which profiles fit

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
    api/intake/      Intake API for automated sources
    actions/         Server actions (login, language, candidates, CV import, settings)
  components/        Shared UI (sidebar, badges, timeline, charts)
  lib/
    engine/          CV processing: text extraction, contact parsing, OpenAI and demo analysis, pipeline
    nurture/         Email sequences: default templates, rendering, sending, engagement rules
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
