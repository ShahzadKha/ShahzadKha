# Demo script — 15 minutes

A walkthrough to show the client their whole diagram (steps 1 to 26) working in one application.
The interface is in French; button names below are written exactly as they appear on screen.

## Before the demo (5 minutes)

1. Reset the demo data so every number is fresh: `npm run db:seed`.
2. Open **two browser windows** side by side:
   - **Window A (the team)**: log in as `admin@demo.local` (password `demo1234`).
   - **Window B (the candidate)**: a **private / incognito** window, not logged in.
3. Keep the `samples/` folder open, to drag CVs from it.

## 1. The problem (1 min)

Show their BPMN diagram. Today it needs Activepieces, aitable.ai, OpenAI, Acumbamail, ThriveCart and
a spreadsheet for the SDRs, with no single view of a candidate.
**Message**: "Everything in your diagram now runs in one application, with one dashboard."

## 2. The dashboard (2 min) — *Tableau de bord*

- Top row: new candidates, eligibility rate, AI score, purchase-ready, **sales and revenue**, conversion, NPS.
- **Entonnoir de conversion**: where candidates drop off, step by step.
- Performance by **source** (which channel brings buyers) and by **SDR**.
- Switch the period (7 / 30 / 90 days / Tout).

## 3. Candidates arrive (3 min) — steps 1 to 9

1. **Web form, a strong profile.** In **window B**, open `/apply` (the public form, like their
   landing page). Fill in *Thomas Girard*, email `thomas.girard@example.com`, upload
   `samples/CV_Thomas_Girard.pdf`, write "Je veux devenir analyste SOC, je peux commencer
   rapidement", tick consent, send.
   In **window A**, open **Candidats → Thomas Girard**: high score (≈ 87), track **Invitation à
   échanger**, so his **first email already contains the offer** (status *Offre envoyée*).
   **Message**: "Hot leads skip the slow nurturing, exactly as in your routing rules."
2. **Bulk import.** **Candidats → Importer des CV**, drag `CV_Sarah_Benali.pdf`,
   `CV_Karim_Haddad.pdf` and `CV_Julien_Petit.docx`, click **Lancer l'import**. Watch the results appear:
   - Sarah (≈ 75) and Julien (Word file) → **Email 1 envoyé**, conversion sequence.
   - Karim (a chef) → **Non éligible**: no training fits, no emails sent.
3. **Duplicates.** Click **Vider la liste**, drag `CV_Sarah_Benali_mise_a_jour.txt`:
   **Doublon — fiche existante mise à jour**. Sarah is updated, not duplicated.
4. Open **Sarah's profile** and show the **AI analysis** (scores, persona, skill gap, summary,
   recommended training and price), the **follow-up track**, and the **history**.

## 4. Nurturing (3 min) — steps 10 to 18

On Sarah's profile, section **Séquence email**:

1. Click **Ouvre l'email** → status **Engagé**. (Real emails do this with open tracking.)
2. Click **Répond : intéressé(e)** → the sequence stops (as in the diagram: "si pas de réponse"),
   interest is confirmed and the **personalised offer email** goes out automatically
   → status **Offre envoyée** (the history shows *Intérêt confirmé* then *Offre envoyée*).
3. Open the email "Votre offre personnalisée" in the list, copy its link and paste it into
   **window B**: this is the **offer page** with the price. Viewing it = **Prix consulté**.
4. Back in window A, refresh: the 4 **Purchase Ready** conditions are met (fit, interest, price
   viewed, and her CV says she is available soon), so Sarah is **automatically handed to an SDR**
   (step 19) with a call task. The SDR got a notification (bell).

Show **Séquences email**: the 5 sequences with their open and reply rates, every email editable,
and **Simuler +7 jours** to show time passing.

## 5. Closing and payment (3 min) — steps 19 to 23

1. Open **Espace SDR**: the call queue, most urgent first, overdue calls in red.
2. Open Sarah's **Fiche d'appel** (as admin you see every SDR's calls; an SDR only sees their own): the candidate brief on the left, the **call script** in the
   middle (with her name, training, price and skill gap filled in), the result on the right.
3. Choose **Prêt(e) à s'inscrire — envoyer le lien de paiement**, pick a blocker ("Financement"),
   add a note, **Enregistrer l'appel**.
4. On Sarah's profile, open the email "votre lien d'inscription", copy the link into **window B**:
   the checkout page. Click **Confirmer mon inscription (démo)**.
   With their ThriveCart link set in Settings, this goes to real ThriveCart instead.
5. Window A: Sarah is **Gagné**, the payment is recorded, the SDR is notified, and the
   **welcome email** (onboarding, step 24) has gone out.

## 6. After the sale (1 min) — steps 24 to 26

On Sarah's profile, **Envoyer l'email suivant maintenant** twice: the CV/LinkedIn coaching email
(day 60), then the **feedback request** (day 90). Its link opens the NPS page (0–10, testimonial
with publishing consent, refer a friend). The dashboard NPS updates.

## 7. Everything is configurable (1 min) — *Paramètres* and *Intégrations*

- **Intégrations**: each connection (OpenAI, emails, mailbox, Acumbamail, ThriveCart, API, form)
  with its status and a test button.

- Brand name (white-label), score weights and **routing thresholds**, Purchase Ready conditions.
- Training catalogue: price, keywords that guide the AI, **ThriveCart link**.
- SDR settings: automatic assignment, time to call, **call script**.
- **Pipeline**: drag a card to change a candidate's status.

## Questions they will ask

| Question | Answer |
|----------|--------|
| Is the AI real? | The demo uses a rule-based "demo mode". With their OpenAI key, every CV is analysed by OpenAI (one setting). |
| Are emails really sent? | In the demo they are simulated. With their SMTP details (Acumbamail works), they are sent for real, with open and click tracking. |
| Does ThriveCart work? | Yes: checkout link per training + webhook. We validate it with one test order on their account. |
| Can we connect our email inbox? | Yes: CVs sent to the mailbox become candidates, and candidates' replies are read and classified automatically. |
| Job boards / partners / Activepieces? | CSV import (with partner name) or the import API (`/api/intake`). |
| Acumbamail? | Contacts are synced to their Acumbamail list with custom fields (status, score, training…), and Acumbamail can be the SMTP sender. |
| Can we put the form on our landing page? | Yes: a direct link or an `<iframe>` code on the Intégrations page, with `ref=` to track each page or partner. |
| GDPR? | Consent on the form, unsubscribe link in every email, "only email consenting candidates" option, candidate deletion. |
| Can we change the emails and rules ourselves? | Yes, everything is in Séquences email and Paramètres, without code. |
| Where is it hosted? | Vercel + a PostgreSQL database (Neon), or any server they prefer. |

## To go live, we need from them

1. Their training catalogue (names, prices, descriptions, ThriveCart links).
2. An OpenAI API key.
3. SMTP details for sending (Acumbamail or other) and the sender address.
4. The mailbox that receives CVs and replies (IMAP access), and their Acumbamail API token and list.
5. The ThriveCart webhook secret.
6. The list of users (admins, recruiters, SDRs).
7. A domain name, if they want one (e.g. `recrutement.skilltec.fr`).
