# Recruitment System

A dashboard app that turns incoming CVs into training sales:
**CV → AI analysis → email nurturing → SDR closing → payment → onboarding**.

It replaces the Activepieces + aitable.ai workflow from the client's diagram with one application,
while keeping the same steps, statuses and routing rules.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Foundation: login and roles, database, demo data, candidate list and profile with timeline, dashboard overview | ✅ Done |
| 2 | AI engine: CV upload and parsing, deduplication, OpenAI analysis, scoring and routing rules | ⏳ Next |
| 3 | Nurturing: pipeline board, email sequences, simulated email events | |
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

# 3. Create your settings file
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
    actions/         Server actions (login, language, candidates)
  components/        Shared UI (sidebar, badges, timeline, charts)
  lib/
    pipeline.ts      Pipeline statuses, phases, score bands and "Purchase Ready" rules
    i18n/            French and English texts
    auth.ts          Current user and role checks
    session.ts       Session cookie signing
  proxy.ts           Redirects visitors who are not logged in to /login
```

## How it maps to the client's diagram

- **Statuses** follow the diagram legend exactly: `NEW_CV → CV_PARSED → GPT_ANALYZED → NOT_ELIGIBLE / PRODUCT_MATCHED → EMAIL_1_SENT → ENGAGED → INTEREST_CONFIRMED → OFFER_SENT → PRICE_VIEWED → PURCHASE_READY → SDR_ASSIGNED → CALL_COMPLETED → WON / LOST / NURTURE`.
- **Sources** are the five triggers: incoming email, web form, CSV/API import, CV drop and manual entry.
- **Score bands** follow the routing rules: below 50, 50–64, 65–79, 80–89 and 90–100.
- **Purchase Ready** uses the four conditions: fit ≥ 70 and eligible, explicit interest, price viewed, and timing within 30 days.
- **Deduplication (step 4)**: adding a candidate whose email already exists updates that record and logs "Doublon détecté" in the timeline.
- **Timeline**: every step (CV parsed, AI analysis, emails, replies, SDR call, payment) is saved as an event on the candidate.
- **White-label**: the brand name ("Skilltec") is stored in the `Setting` table, not in the code.

All demo data is generated. It contains no real people's personal data.
