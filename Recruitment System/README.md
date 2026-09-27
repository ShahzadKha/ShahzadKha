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
| 3 | Nurturing: pipeline board, email sequences, simulated email events | ⏳ Next |
| 4 | Closing: SDR workspace, call logging, simulated ThriveCart payment, onboarding | |
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

`npm run db:seed` resets the demo data at any time.

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
    api/intake/      Intake API for automated sources
    actions/         Server actions (login, language, candidates, CV import, settings)
  components/        Shared UI (sidebar, badges, timeline, charts)
  lib/
    engine/          CV processing: text extraction, contact parsing, OpenAI and demo analysis, pipeline
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
