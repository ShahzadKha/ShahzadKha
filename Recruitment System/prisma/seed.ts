// Demo data: fake users, products and candidates spread across the whole pipeline.
// Each candidate's story (emails, opens, replies, offer page…) is replayed with the same
// rules as the real engine on a virtual clock, so statuses, emails and timelines always agree.
// All people and emails are generated (example.com) — no real personal data.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { fakerFR as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomUUID } from "node:crypto";
import type { CandidateSource, CandidateStatus, EventType, RoutingTrack } from "../src/generated/prisma/enums";
import { DEFAULT_RULES, globalScore as computeGlobal, purchaseReadyConditions, trackFromScore } from "../src/lib/rules";
import { normalizePhone } from "../src/lib/engine/parse";
import { DEFAULT_OFFER_EMAIL, DEFAULT_SEQUENCES, type DefaultStep } from "../src/lib/nurture/defaults";
import { renderEmail } from "../src/lib/nurture/render";
import { canAdvance, shouldRecycle } from "../src/lib/nurture/status";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

faker.seed(2026);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PRODUCTS = [
  {
    name: "Formation Data Analyst",
    keywords: ["Excel", "SQL", "Power BI", "Python", "Statistiques", "Reporting", "Tableau de bord", "Data", "Comptabilité", "Contrôle de gestion"],
    description: "SQL, Python, Power BI — 12 semaines, certification incluse",
    price: 2490,
    titles: ["Assistant(e) comptable", "Contrôleur de gestion junior", "Chargé(e) de reporting", "Analyste commercial"],
    skills: ["Excel", "SQL", "Power BI", "Python", "Statistiques", "Reporting"],
  },
  {
    name: "Développeur Web Full-Stack",
    keywords: ["HTML", "CSS", "JavaScript", "React", "Git", "WordPress", "Node.js", "PHP", "Développement web", "Intégration"],
    description: "JavaScript, React, Node.js — 16 semaines, projet professionnel",
    price: 3990,
    titles: ["Technicien support", "Intégrateur web", "Webmaster", "Technicien informatique"],
    skills: ["HTML", "CSS", "JavaScript", "React", "Git", "WordPress"],
  },
  {
    name: "Chef de Projet Digital",
    keywords: ["Gestion de projet", "Agile", "Scrum", "Trello", "Communication", "Budget", "Coordination", "Planning", "Jira"],
    description: "Gestion de projet agile, UX, pilotage — 10 semaines",
    price: 2990,
    titles: ["Chargé(e) de communication", "Assistant(e) de direction", "Coordinateur(rice) événementiel", "Chef de rayon"],
    skills: ["Gestion de projet", "Agile", "Trello", "Communication", "Budget", "Coordination"],
  },
  {
    name: "Cybersécurité – Analyste SOC",
    keywords: ["Linux", "Réseaux", "Windows Server", "Active Directory", "Firewall", "Scripting", "Sécurité", "Cisco", "VPN", "Support informatique"],
    description: "Réseaux, SIEM, réponse à incident — 14 semaines",
    price: 4490,
    titles: ["Administrateur systèmes", "Technicien réseau", "Support informatique N2", "Technicien de maintenance"],
    skills: ["Linux", "Réseaux", "Windows Server", "Active Directory", "Firewall", "Scripting"],
  },
  {
    name: "Marketing Digital & Growth",
    keywords: ["Réseaux sociaux", "SEO", "Canva", "Google Ads", "Rédaction", "CRM", "Marketing", "E-commerce", "Community management", "Vente"],
    description: "SEO, Ads, CRM, automatisation — 8 semaines",
    price: 1990,
    titles: ["Vendeur(se)", "Conseiller(ère) commercial", "Community manager", "Assistant(e) marketing"],
    skills: ["Réseaux sociaux", "SEO", "Canva", "Google Ads", "Rédaction", "CRM"],
  },
];

const PERSONAS = [
  "Reconversion professionnelle",
  "Montée en compétences",
  "Jeune diplômé(e) en recherche d'emploi",
  "Demandeur d'emploi qualifié",
  "Salarié(e) visant une promotion",
];

const EDUCATION = [
  "Licence Économie – Université de Lyon",
  "BTS Services informatiques aux organisations",
  "Master Marketing – IAE de Bordeaux",
  "DUT Gestion des entreprises – IUT de Nantes",
  "Bac+2 Commerce – Lille",
  "Licence pro Réseaux et télécoms – Toulouse",
];

const LOST_REASONS = ["Budget insuffisant", "A choisi un autre organisme", "Projet reporté à l'année prochaine"];
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// Story each demo candidate goes through, and how many of each
type Story =
  | "NEW_CV" | "CV_PARSED" | "NOT_ELIGIBLE" | "EMAIL_1_SENT" | "ENGAGED" | "NURTURE" | "OFFER_SENT"
  | "PRICE_VIEWED" | "PURCHASE_READY" | "SDR_ASSIGNED" | "CALL_COMPLETED" | "WON" | "LOST_CALL"
  | "LOST_REPLY" | "LOST_UNSUB";

const DISTRIBUTION: [Story, number][] = [
  ["NEW_CV", 2],
  ["CV_PARSED", 2],
  ["NOT_ELIGIBLE", 5],
  ["EMAIL_1_SENT", 6],
  ["ENGAGED", 6],
  ["NURTURE", 4],
  ["OFFER_SENT", 4],
  ["PRICE_VIEWED", 3],
  ["PURCHASE_READY", 3],
  ["SDR_ASSIGNED", 3],
  ["CALL_COMPLETED", 2],
  ["WON", 6],
  ["LOST_CALL", 1],
  ["LOST_REPLY", 1],
  ["LOST_UNSUB", 1],
];

// Track (score band) to aim for, so each story is realistic
function targetTrack(story: Story): RoutingTrack {
  switch (story) {
    case "EMAIL_1_SENT":
    case "ENGAGED":
      return faker.helpers.arrayElement(["LIGHT", "CONVERSION", "CONVERSION"]);
    case "NURTURE":
      return faker.helpers.arrayElement(["EDUCATIONAL", "LIGHT", "CONVERSION"]);
    case "OFFER_SENT":
    case "LOST_REPLY":
    case "LOST_UNSUB":
      return faker.helpers.arrayElement(["LIGHT", "CONVERSION", "CALL_INVITE"]);
    default:
      return faker.helpers.arrayElement(["CONVERSION", "CALL_INVITE", "CALL_INVITE", "PRIORITY_SDR"]);
  }
}

const BAND_MID: Record<RoutingTrack, [number, number]> = {
  EDUCATIONAL: [42, 48],
  LIGHT: [52, 63],
  CONVERSION: [66, 78],
  CALL_INVITE: [81, 88],
  PRIORITY_SDR: [90, 95],
};

type SimEvent = { type: EventType; title: string; detail?: string | null; toStatus?: CandidateStatus; actorId?: string | null; t: number };
type SimMessage = {
  token: string; stepId: string | null; kind: "sequence" | "offer"; subject: string; body: string; t: number;
  openedAt?: number; clickedAt?: number; repliedAt?: number;
};

/** Mirrors src/lib/nurture/engine.ts on a virtual clock (t = milliseconds). */
class Sim {
  status: CandidateStatus;
  events: SimEvent[] = [];
  messages: SimMessage[] = [];
  enrollment: null | { status: "ACTIVE" | "COMPLETED" | "STOPPED"; startedAt: number; stepsSent: number; endedAt?: number; endReason?: string } = null;
  interestConfirmed = false;
  priceViewed = false;
  timingDays: number | null = null;
  unsubscribedAt: number | null = null;

  constructor(status: CandidateStatus, private vars: { prenom: string; nom: string; produit: string; prix: string; poste: string; marque: string }, private publicToken: string, private fit: number) {
    this.status = status;
  }
  event(e: SimEvent) {
    this.events.push(e);
  }
  advance(to: CandidateStatus, t: number, title: string, detail?: string | null, type: EventType = "STATUS_CHANGED", actorId?: string | null) {
    if (!canAdvance(this.status, to)) return false;
    this.status = to;
    this.event({ type, title, detail, toStatus: to, t, actorId });
    return true;
  }
  set(to: CandidateStatus, t: number, title: string, detail?: string | null, actorId?: string | null) {
    this.status = to;
    this.event({ type: "STATUS_CHANGED", title, detail, toStatus: to, t, actorId });
  }
  send(template: { subject: string; body: string }, t: number, meta: { stepId: string | null; kind: "sequence" | "offer" }) {
    const token = randomUUID();
    const email = renderEmail(template, { ...this.vars, lien_offre: `${APP_URL}/api/t/c/${token}` }, {
      unsubscribe: `${APP_URL}/desinscription/${this.publicToken}`,
    });
    this.messages.push({ token, stepId: meta.stepId, kind: meta.kind, subject: email.subject, body: email.text, t });
    this.event({ type: "EMAIL_SENT", title: "Email envoyé", detail: email.subject, t });
    return this.messages.length - 1;
  }
  startSequence(name: string, t: number) {
    this.enrollment = { status: "ACTIVE", startedAt: t, stepsSent: 0 };
    this.event({ type: "SEQUENCE_STARTED", title: "Séquence démarrée", detail: name, t });
  }
  sendStep(step: DefaultStep & { id: string }, index: number, t: number, sequenceName: string) {
    this.send(step, t, { stepId: step.id, kind: "sequence" });
    this.enrollment!.stepsSent++;
    if (index === 0) this.advance("EMAIL_1_SENT", t + 1, "Email 1 envoyé", sequenceName);
    if (step.isOffer) this.advance("OFFER_SENT", t + 2, "Offre envoyée", step.subject);
  }
  open(i: number, t: number) {
    const m = this.messages[i];
    if (m.openedAt) return;
    m.openedAt = t;
    this.event({ type: "EMAIL_OPENED", title: "Email ouvert", detail: m.subject, t });
    this.advance("ENGAGED", t + 1, "Engagé", "Premier email ouvert");
  }
  click(i: number, t: number) {
    const m = this.messages[i];
    m.openedAt ??= t;
    m.clickedAt = t;
    this.event({ type: "EMAIL_CLICKED", title: "Lien cliqué", detail: m.subject, t });
    this.advance("ENGAGED", t + 1, "Engagé", "Lien cliqué");
  }
  stop(t: number, reason: string, actorId?: string | null) {
    if (this.enrollment?.status !== "ACTIVE") return;
    Object.assign(this.enrollment, { status: "STOPPED", endedAt: t, endReason: reason });
    this.event({ type: "SEQUENCE_ENDED", title: "Séquence arrêtée", detail: reason, t, actorId });
  }
  complete(t: number) {
    Object.assign(this.enrollment!, { status: "COMPLETED", endedAt: t, endReason: "Séquence terminée" });
    this.event({ type: "SEQUENCE_ENDED", title: "Séquence terminée", detail: "Tous les emails ont été envoyés", t });
    if (shouldRecycle(this)) this.set("NURTURE", t + 1, "Recyclage", "Pas de réponse — retour en nurturing");
  }
  reply(positive: boolean, t: number, text: string) {
    const last = this.messages[this.messages.length - 1];
    last.repliedAt = t;
    last.openedAt ??= t;
    this.event({ type: "EMAIL_REPLIED", title: "Réponse reçue", detail: text, t });
    this.stop(t + 1, "Réponse reçue");
    if (!positive) {
      this.advance("LOST", t + 2, "Perdu", "Pas intéressé(e)");
      return;
    }
    this.interestConfirmed = true;
    this.advance("INTEREST_CONFIRMED", t + 2, "Intérêt confirmé", "Réponse positive");
    this.send(DEFAULT_OFFER_EMAIL, t + 20 * 60 * 1000, { stepId: null, kind: "offer" });
    this.advance("OFFER_SENT", t + 20 * 60 * 1000 + 1, "Offre envoyée", "Offre personnalisée");
  }
  priceView(t: number) {
    this.priceViewed = true;
    this.event({ type: "PRICE_VIEWED", title: "Page prix consultée", detail: "Page offre personnalisée", t });
    this.advance("PRICE_VIEWED", t + 1, "Prix consulté", "Page offre personnalisée");
  }
  callback(timing: number, t: number) {
    this.interestConfirmed = true;
    this.timingDays = timing;
    this.event({ type: "EMAIL_REPLIED", title: "Demande de rappel", detail: `Souhaite démarrer sous ${timing} jours`, t });
    this.stop(t + 1, "Intérêt confirmé");
    const c = purchaseReadyConditions({ fitScore: this.fit, eligible: true, interestConfirmed: true, priceViewed: this.priceViewed, timingDays: timing }, DEFAULT_RULES);
    if (c.fit && c.interest && c.price && c.timing) this.advance("PURCHASE_READY", t + 2, "Prêt à acheter", "4/4 conditions remplies");
  }
  unsubscribe(t: number) {
    this.unsubscribedAt = t;
    this.event({ type: "UNSUBSCRIBED", title: "Désinscription", detail: "Ne reçoit plus d'emails", t });
    this.stop(t + 1, "Désinscription");
    this.advance("LOST", t + 2, "Perdu", "Désinscription");
  }
}

const rand = (min: number, max: number) => faker.number.float({ min, max });

async function main() {
  console.log("Resetting demo data…");
  await db.emailMessage.deleteMany();
  await db.enrollment.deleteMany();
  await db.emailStep.deleteMany();
  await db.emailSequence.deleteMany();
  await db.candidateEvent.deleteMany();
  await db.candidate.deleteMany();
  await db.product.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();

  await db.setting.createMany({
    data: [
      { key: "brandName", value: "Skilltec" },
      { key: "brandTagline", value: "Conversion CV → Achat" },
      { key: "scoringRules", value: DEFAULT_RULES },
    ],
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const admin = await db.user.create({ data: { name: "Admin Démo", email: "admin@demo.local", passwordHash, role: "ADMIN" } });
  const sdrs = await Promise.all(
    [
      ["Camille Laurent", "camille@demo.local"],
      ["Yanis Moreau", "yanis@demo.local"],
    ].map(([name, email]) => db.user.create({ data: { name, email, passwordHash, role: "SDR" } })),
  );
  const recruiter = await db.user.create({ data: { name: "Inès Robert", email: "recruteur@demo.local", passwordHash, role: "RECRUITER" } });

  const products = await Promise.all(
    PRODUCTS.map((p) => db.product.create({ data: { name: p.name, description: p.description, price: p.price, keywords: p.keywords } })),
  );

  // Email sequences from the defaults
  const sequences = new Map<RoutingTrack, { id: string; name: string; steps: (DefaultStep & { id: string })[] }>();
  for (const [track, def] of Object.entries(DEFAULT_SEQUENCES) as [RoutingTrack, (typeof DEFAULT_SEQUENCES)[RoutingTrack]][]) {
    const seq = await db.emailSequence.create({
      data: {
        track,
        name: def.name,
        steps: { create: def.steps.map((s, i) => ({ order: i + 1, dayOffset: s.dayOffset, subject: s.subject, body: s.body, isOffer: Boolean(s.isOffer) })) },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    sequences.set(track, { id: seq.id, name: seq.name, steps: seq.steps.map((s) => ({ ...s, isOffer: s.isOffer })) });
  }

  const sources: CandidateSource[] = ["EMAIL", "WEB_FORM", "WEB_FORM", "CSV_IMPORT", "FILE_DROP", "MANUAL"];
  const now = Date.now();
  let sdrTurn = 0;
  let count = 0;

  for (const [story, n] of DISTRIBUTION) {
    for (let i = 0; i < n; i++) {
      const productIndex = faker.number.int({ min: 0, max: PRODUCTS.length - 1 });
      const productDef = PRODUCTS[productIndex];
      const product = products[productIndex];
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName, provider: "example.com", allowSpecialCharacters: false }).toLowerCase();
      const phone = faker.phone.number({ style: "national" });
      const source = faker.helpers.arrayElement(sources);
      const publicToken = randomUUID().replace(/-/g, "");
      const currentTitle = faker.helpers.arrayElement(productDef.titles);
      const yearsExperience = faker.number.int({ min: 0, max: 15 });
      const skills = faker.helpers.arrayElements(productDef.skills, { min: 3, max: 5 });
      const persona = faker.helpers.arrayElement(PERSONAS);
      const education = faker.helpers.arrayElement(EDUCATION);
      const city = faker.location.city();
      const cvFileName = `CV_${firstName}_${lastName}.pdf`.replace(/\s+/g, "_");

      const parsed = story !== "NEW_CV";
      const analyzed = parsed && story !== "CV_PARSED";
      const notEligible = story === "NOT_ELIGIBLE";

      // Scores: pick the wanted track, then scores that land in its band
      let fitScore: number | null = null, needScore: number | null = null, intentScore: number | null = null, score: number | null = null;
      let track: RoutingTrack | null = null;
      if (analyzed) {
        if (notEligible) {
          fitScore = faker.number.int({ min: 18, max: 45 });
          needScore = faker.number.int({ min: 20, max: 60 });
          intentScore = faker.number.int({ min: 15, max: 50 });
        } else {
          const want = targetTrack(story);
          const target = faker.number.int({ min: BAND_MID[want][0], max: BAND_MID[want][1] });
          const needsPR = ["PURCHASE_READY", "SDR_ASSIGNED", "CALL_COMPLETED", "WON", "LOST_CALL"].includes(story);
          fitScore = Math.min(97, Math.max(needsPR ? 74 : 55, target + faker.number.int({ min: -4, max: 8 })));
          needScore = Math.min(95, Math.max(30, target + faker.number.int({ min: -10, max: 10 })));
          intentScore = Math.min(98, Math.max(10, Math.round((target * 100 - fitScore * 50 - needScore * 25) / 25)));
        }
        score = computeGlobal({ fit: fitScore, need: needScore!, intent: intentScore! }, DEFAULT_RULES);
        track = notEligible ? null : trackFromScore(score, DEFAULT_RULES);
      }

      // ── Replay the story on a virtual clock (t = 0 when the CV arrives) ──
      const sim = new Sim(
        "NEW_CV",
        { prenom: firstName, nom: lastName, produit: product.name, prix: `${product.price.toLocaleString("fr-FR")} €`, poste: currentTitle, marque: "Skilltec" },
        publicToken,
        fitScore ?? 0,
      );
      let t = 0;
      sim.event({ type: "CREATED", title: "Candidat créé", detail: cvFileName, toStatus: "NEW_CV", t });
      let vNow = rand(0.5, 20) * DAY; // "now" on the virtual clock, adjusted below
      let sdr: (typeof sdrs)[number] | null = null;

      if (parsed) {
        t += rand(1, 4) * 60_000;
        sim.advance("CV_PARSED", t, "CV extrait", "Texte + nom, email, téléphone, poste", "CV_PARSED");
      }
      if (analyzed) {
        t += rand(1, 3) * 60_000;
        sim.advance("GPT_ANALYZED", t, "Analyse IA", `Score global ${score}/100 · mode démo`, "AI_ANALYZED");
        t += 1000;
        if (notEligible) {
          sim.set("NOT_ELIGIBLE", t, "Non éligible", "Aucune formation ne correspond au profil");
        } else {
          sim.advance("PRODUCT_MATCHED", t, "Produit associé", product.name);
          sim.event({ type: "ROUTED", title: "Parcours", detail: track!, t: t + 1 });
        }
      }

      if (track) {
        const seq = sequences.get(track)!;
        const steps = seq.steps;
        const tE = t + 2000;
        sim.startSequence(seq.name, tE);
        const firstOffer = steps.findIndex((s) => s.isOffer);
        const sendUntil = (limitDays: number) => {
          while (sim.enrollment!.status === "ACTIVE" && sim.enrollment!.stepsSent < steps.length && steps[sim.enrollment!.stepsSent].dayOffset * DAY <= limitDays * DAY) {
            const idx = sim.enrollment!.stepsSent;
            sim.sendStep(steps[idx], idx, tE + steps[idx].dayOffset * DAY + (idx === 0 ? 0 : rand(0, 2) * HOUR), seq.name);
          }
        };
        const between = (idx: number) => {
          // A moment after step idx-1 and before step idx
          const a = steps[idx - 1].dayOffset;
          const b = steps[idx]?.dayOffset ?? a + 2;
          return rand(a + 0.1, Math.max(a + 0.2, b - 0.1));
        };

        const endorse = ["SDR_ASSIGNED", "CALL_COMPLETED", "WON", "LOST_CALL", "PURCHASE_READY", "PRICE_VIEWED", "OFFER_SENT", "LOST_REPLY"].includes(story);

        if (story === "EMAIL_1_SENT") {
          sendUntil(0);
          vNow = tE + between(1) * DAY;
        } else if (story === "ENGAGED") {
          const k = faker.number.int({ min: 1, max: Math.max(1, (firstOffer > 0 ? firstOffer : steps.length) - 0) });
          const upto = Math.min(k, steps.length - 1);
          sendUntil(steps[upto - 1].dayOffset);
          sim.open(0, tE + rand(1, 20) * HOUR);
          if (faker.datatype.boolean()) sim.click(0, tE + rand(21, 30) * HOUR);
          vNow = tE + between(upto) * DAY;
        } else if (story === "NURTURE") {
          sendUntil(steps[steps.length - 1].dayOffset);
          if (faker.datatype.boolean()) sim.open(0, tE + rand(2, 30) * HOUR);
          const end = tE + (steps[steps.length - 1].dayOffset + 2) * DAY;
          sim.complete(end);
          vNow = end + rand(1, 10) * DAY;
        } else if (story === "LOST_UNSUB") {
          sendUntil(steps[Math.min(1, steps.length - 1)].dayOffset);
          sim.open(0, tE + rand(1, 10) * HOUR);
          const tu = tE + (steps[Math.min(1, steps.length - 1)].dayOffset + 0.5) * DAY;
          sim.unsubscribe(tu);
          vNow = tu + rand(1, 8) * DAY;
        } else if (endorse) {
          // Opens, maybe reads a few emails, then replies "interested"
          const replyDay = rand(0.3, firstOffer > 0 ? Math.max(0.5, steps[firstOffer].dayOffset - 0.3) : 1.5);
          sendUntil(replyDay);
          sim.open(0, tE + Math.min(replyDay * DAY - HOUR, rand(1, 6) * HOUR));
          const tr = tE + replyDay * DAY;
          if (story === "LOST_REPLY") {
            sim.reply(false, tr, "Merci, mais ce n'est pas le bon moment pour moi.");
            vNow = tr + rand(1, 6) * DAY;
          } else {
            sim.reply(true, tr, faker.helpers.arrayElement([
              "Bonjour, je suis intéressé(e). Quelles sont les options de financement ?",
              "Le programme m'intéresse, quand commence la prochaine session ?",
              "Pouvez-vous m'envoyer le détail du programme et le tarif ?",
            ]));
            t = tr + 20 * 60 * 1000;
            vNow = t + rand(0.3, 3) * DAY;
            if (story !== "OFFER_SENT") {
              const offerIdx = sim.messages.length - 1;
              t += rand(1, 20) * HOUR;
              sim.click(offerIdx, t);
              sim.priceView(t + 30_000);
              vNow = t + rand(0.3, 3) * DAY;
              if (story !== "PRICE_VIEWED") {
                t += rand(5, 40) * 60_000;
                sim.callback(faker.helpers.arrayElement([14, 30]), t);
                vNow = t + rand(0.2, 2) * DAY;
              } else if (faker.datatype.boolean()) {
                t += rand(5, 40) * 60_000;
                sim.callback(60, t); // interested, but starts later: not purchase ready
                vNow = t + rand(0.2, 2) * DAY;
              }
            }
            if (["SDR_ASSIGNED", "CALL_COMPLETED", "WON", "LOST_CALL"].includes(story)) {
              sdr = sdrs[sdrTurn++ % sdrs.length];
              t += rand(5, 60) * 60_000;
              sim.advance("SDR_ASSIGNED", t, "Assigné à un SDR", sdr.name, "SDR_ASSIGNED");
              vNow = t + rand(0.1, 2) * DAY;
              if (story !== "SDR_ASSIGNED") {
                t += rand(1, 3) * DAY;
                sim.advance("CALL_COMPLETED", t, "Appel de closing", `Appel de ${faker.number.int({ min: 15, max: 40 })} min — ${faker.helpers.arrayElement(["question sur le financement CPF", "hésitation sur le calendrier", "très motivé(e), attend le lien de paiement"])}`, "CALL_LOGGED", sdr.id);
                vNow = t + rand(0.2, 2) * DAY;
                if (story === "WON") {
                  t += rand(2, 48) * HOUR;
                  sim.advance("WON", t, "Paiement confirmé", `ThriveCart — ${product.name} (${product.price} €)`, "PAYMENT_CONFIRMED");
                  vNow = t + rand(0.5, 15) * DAY;
                } else if (story === "LOST_CALL") {
                  t += rand(1, 4) * DAY;
                  sim.advance("LOST", t, "Perdu", faker.helpers.arrayElement(LOST_REASONS), "STATUS_CHANGED", sdr.id);
                  vNow = t + rand(0.5, 10) * DAY;
                }
              }
            }
          }
        }
      }

      // Shift the virtual clock so that vNow = real now
      const offset = now - Math.max(vNow, ...sim.events.map((e) => e.t + 60_000));
      const at = (v: number) => new Date(v + offset);

      if (sdr && faker.datatype.boolean()) {
        const last = Math.max(...sim.events.map((e) => e.t));
        sim.event({
          type: "NOTE",
          title: "Note",
          detail: faker.helpers.arrayElement([
            "Préfère être rappelé(e) en fin de journée.",
            "A déjà suivi une formation en ligne, attentif(ve) à l'accompagnement.",
            "Demande une facture au nom de son entreprise.",
          ]),
          actorId: sdr.id,
          t: last + HOUR > vNow ? last + 1 : last + HOUR,
        });
      }

      const seq = track ? sequences.get(track)! : null;
      const e = sim.enrollment;
      const nextStep = e && seq ? seq.steps[e.stepsSent] : null;
      const lastT = Math.max(...sim.events.map((x) => x.t));

      await db.candidate.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          phoneKey: normalizePhone(phone),
          city,
          country: "France",
          source,
          status: sim.status,
          publicToken,
          cvFileName,
          currentTitle: parsed ? currentTitle : null,
          yearsExperience: parsed ? yearsExperience : null,
          education: parsed ? education : null,
          skills: parsed ? skills : [],
          languages: parsed ? faker.helpers.arrayElements(["Français", "Anglais", "Espagnol", "Arabe"], { min: 1, max: 3 }) : [],
          linkedinUrl: parsed ? `https://www.linkedin.com/in/${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, "-") : null,
          cvText: parsed ? `${firstName} ${lastName}\n${currentTitle} — ${yearsExperience} ans d'expérience\n${city}\n\nFormation : ${education}\nCompétences : ${skills.join(", ")}` : null,
          consentAt: source === "WEB_FORM" ? at(0) : null,
          persona: analyzed ? persona : null,
          skillGap: analyzed
            ? notEligible
              ? "Profil trop éloigné des formations proposées"
              : `Manque de pratique en ${faker.helpers.arrayElement(productDef.skills.filter((s) => !skills.includes(s)).concat(productDef.skills[0]))}`
            : null,
          aiSummary: analyzed
            ? notEligible
              ? `${currentTitle} avec ${yearsExperience} ans d'expérience. Le profil ne correspond à aucune formation du catalogue actuel.`
              : `${currentTitle} avec ${yearsExperience} ans d'expérience, profil « ${persona.toLowerCase()} ». Bonne base en ${skills.slice(0, 2).join(" et ")}. La formation « ${product.name} » permettrait d'accéder à un poste mieux rémunéré.`
            : null,
          fitScore,
          needScore,
          intentScore,
          globalScore: score,
          eligible: analyzed ? !notEligible : null,
          routingTrack: track,
          analysisState: analyzed ? "DONE" : null,
          analysisMode: analyzed ? "demo" : null,
          analyzedAt: analyzed ? at(sim.events.find((x) => x.type === "AI_ANALYZED")!.t) : null,
          recommendedProductId: track ? product.id : null,
          interestConfirmed: sim.interestConfirmed,
          priceViewed: sim.priceViewed,
          timingDays: sim.timingDays ?? (analyzed && !notEligible ? faker.number.int({ min: 45, max: 120 }) : null),
          unsubscribedAt: sim.unsubscribedAt != null ? at(sim.unsubscribedAt) : null,
          assignedSdrId: sdr?.id ?? null,
          createdAt: at(0),
          updatedAt: at(lastT),
          events: {
            create: sim.events.map((x) => ({ type: x.type, title: x.title, detail: x.detail ?? null, toStatus: x.toStatus, actorId: x.actorId ?? null, createdAt: at(x.t) })),
          },
          emails: {
            create: sim.messages.map((m) => ({
              token: m.token,
              stepId: m.stepId,
              kind: m.kind,
              toEmail: email,
              subject: m.subject,
              body: m.body,
              provider: "simulated",
              sentAt: at(m.t),
              openedAt: m.openedAt != null ? at(m.openedAt) : null,
              clickedAt: m.clickedAt != null ? at(m.clickedAt) : null,
              repliedAt: m.repliedAt != null ? at(m.repliedAt) : null,
            })),
          },
          enrollment:
            e && seq
              ? {
                  create: {
                    sequenceId: seq.id,
                    status: e.status,
                    stepsSent: e.stepsSent,
                    startedAt: at(e.startedAt),
                    nextSendAt: e.status === "ACTIVE" ? at(e.startedAt + (nextStep ? nextStep.dayOffset * DAY : (seq.steps[seq.steps.length - 1].dayOffset + 2) * DAY)) : null,
                    endedAt: e.endedAt != null ? at(e.endedAt) : null,
                    endReason: e.endReason ?? null,
                  },
                }
              : undefined,
        },
      });
      count++;
    }
  }

  const byStatus = await db.candidate.groupBy({ by: ["status"], _count: { _all: true } });
  console.log(byStatus.map((s) => `${s.status}: ${s._count._all}`).join(", "));
  console.log(`Seeded ${count} candidates, ${products.length} products, ${2 + sdrs.length} users, ${sequences.size} sequences.`);
  console.log(`Logins (password demo1234): ${admin.email}, ${sdrs.map((s) => s.email).join(", ")}, ${recruiter.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
