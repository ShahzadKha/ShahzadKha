// Demo data: fake users, products and candidates spread across the whole pipeline.
// All people and emails are generated (example.com) — no real personal data.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { fakerFR as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CandidateSource, CandidateStatus, EventType } from "../src/generated/prisma/enums";
import { DEFAULT_RULES, trackFromScore } from "../src/lib/rules";
import { normalizePhone } from "../src/lib/engine/parse";

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

const EMAIL_SEQUENCE = [
  "Email 1 — Diagnostic personnalisé",
  "Email 2 — Impact sur votre shortlist",
  "Email 3 — Offre & programme",
  "Email 4 — Réponses à vos questions",
  "Email 5 — Vérification de votre décision",
  "Email 6 — Dernière relance",
];

const LOST_REASONS = ["Budget insuffisant", "A choisi un autre organisme", "Projet reporté à l'année prochaine"];

// How many demo candidates end up in each status
const DISTRIBUTION: [CandidateStatus, number][] = [
  ["NEW_CV", 3],
  ["CV_PARSED", 2],
  ["GPT_ANALYZED", 1],
  ["NOT_ELIGIBLE", 5],
  ["PRODUCT_MATCHED", 3],
  ["EMAIL_1_SENT", 6],
  ["ENGAGED", 5],
  ["NURTURE", 4],
  ["INTEREST_CONFIRMED", 3],
  ["OFFER_SENT", 2],
  ["PRICE_VIEWED", 2],
  ["PURCHASE_READY", 2],
  ["SDR_ASSIGNED", 3],
  ["CALL_COMPLETED", 1],
  ["WON", 5],
  ["LOST", 3],
];

const MAIN_PATH: CandidateStatus[] = [
  "NEW_CV",
  "CV_PARSED",
  "GPT_ANALYZED",
  "PRODUCT_MATCHED",
  "EMAIL_1_SENT",
  "ENGAGED",
  "INTEREST_CONFIRMED",
  "OFFER_SENT",
  "PRICE_VIEWED",
  "PURCHASE_READY",
  "SDR_ASSIGNED",
  "CALL_COMPLETED",
];

function pathTo(status: CandidateStatus): CandidateStatus[] {
  if (status === "NOT_ELIGIBLE") return [...MAIN_PATH.slice(0, 3), "NOT_ELIGIBLE"];
  if (status === "NURTURE") return [...MAIN_PATH.slice(0, 6), "NURTURE"];
  if (status === "WON" || status === "LOST") return [...MAIN_PATH, status];
  return MAIN_PATH.slice(0, MAIN_PATH.indexOf(status) + 1);
}

const reached = (path: CandidateStatus[], s: CandidateStatus) => path.includes(s);

// Delay before each step, so the timeline looks realistic
const STEP_DELAY: Partial<Record<CandidateStatus, () => number>> = {
  CV_PARSED: () => faker.number.int({ min: 1, max: 4 }) * 60 * 1000,
  GPT_ANALYZED: () => faker.number.int({ min: 1, max: 3 }) * 60 * 1000,
  PRODUCT_MATCHED: () => 30 * 1000,
  NOT_ELIGIBLE: () => 30 * 1000,
  EMAIL_1_SENT: () => faker.number.int({ min: 5, max: 20 }) * 60 * 1000,
  ENGAGED: () => faker.number.int({ min: 4, max: 48 }) * HOUR,
  NURTURE: () => faker.number.int({ min: 6, max: 9 }) * DAY,
  INTEREST_CONFIRMED: () => faker.number.int({ min: 2, max: 5 }) * DAY,
  OFFER_SENT: () => faker.number.int({ min: 1, max: 12 }) * HOUR,
  PRICE_VIEWED: () => faker.number.int({ min: 1, max: 30 }) * HOUR,
  PURCHASE_READY: () => faker.number.int({ min: 1, max: 6 }) * HOUR,
  SDR_ASSIGNED: () => faker.number.int({ min: 5, max: 60 }) * 60 * 1000,
  CALL_COMPLETED: () => faker.number.int({ min: 1, max: 3 }) * DAY,
  WON: () => faker.number.int({ min: 2, max: 48 }) * HOUR,
  LOST: () => faker.number.int({ min: 1, max: 4 }) * DAY,
};

type SeedEvent = {
  type: EventType;
  title: string;
  detail?: string;
  toStatus?: CandidateStatus;
  actorId?: string;
  createdAt: Date;
};

async function main() {
  console.log("Resetting demo data…");
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
  const admin = await db.user.create({
    data: { name: "Admin Démo", email: "admin@demo.local", passwordHash, role: "ADMIN" },
  });
  const sdrs = await Promise.all(
    [
      ["Camille Laurent", "camille@demo.local"],
      ["Yanis Moreau", "yanis@demo.local"],
    ].map(([name, email]) => db.user.create({ data: { name, email, passwordHash, role: "SDR" } })),
  );
  const recruiter = await db.user.create({
    data: { name: "Inès Robert", email: "recruteur@demo.local", passwordHash, role: "RECRUITER" },
  });

  const products = await Promise.all(
    PRODUCTS.map((p) => db.product.create({ data: { name: p.name, description: p.description, price: p.price, keywords: p.keywords } })),
  );

  const sources: CandidateSource[] = ["EMAIL", "WEB_FORM", "WEB_FORM", "CSV_IMPORT", "FILE_DROP", "MANUAL"];
  const now = Date.now();
  let sdrTurn = 0;
  let count = 0;

  for (const [status, n] of DISTRIBUTION) {
    for (let i = 0; i < n; i++) {
      const path = pathTo(status);
      const productIndex = faker.number.int({ min: 0, max: PRODUCTS.length - 1 });
      const productDef = PRODUCTS[productIndex];
      const product = products[productIndex];
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet
        .email({ firstName, lastName, provider: "example.com", allowSpecialCharacters: false })
        .toLowerCase();
      const source = faker.helpers.arrayElement(sources);
      const parsed = reached(path, "CV_PARSED");
      const analyzed = reached(path, "GPT_ANALYZED");
      const notEligible = status === "NOT_ELIGIBLE";
      const stageIndex = path.length;

      // Scores: later stages → higher intent; not eligible → low fit
      const fitScore = analyzed
        ? notEligible
          ? faker.number.int({ min: 18, max: 45 })
          : reached(path, "PURCHASE_READY")
            ? faker.number.int({ min: 74, max: 97 })
            : faker.number.int({ min: 58, max: 92 })
        : null;
      const needScore = analyzed ? faker.number.int({ min: notEligible ? 20 : 55, max: notEligible ? 55 : 95 }) : null;
      const intentScore = analyzed
        ? Math.min(98, (notEligible ? 15 : 35) + stageIndex * 5 + faker.number.int({ min: 0, max: 10 }))
        : null;
      const globalScore =
        fitScore != null && needScore != null && intentScore != null
          ? Math.round(fitScore * 0.5 + needScore * 0.25 + intentScore * 0.25)
          : null;
      const interestConfirmed = reached(path, "INTEREST_CONFIRMED");
      const priceViewed = reached(path, "PRICE_VIEWED");
      const timingDays = analyzed
        ? reached(path, "PURCHASE_READY")
          ? faker.number.int({ min: 5, max: 30 })
          : faker.number.int({ min: 15, max: 120 })
        : null;
      const sdr = reached(path, "SDR_ASSIGNED") ? sdrs[sdrTurn++ % sdrs.length] : null;

      // Build the timeline, walking the path step by step
      const delays = path.slice(1).map((s) => STEP_DELAY[s]?.() ?? HOUR);
      const span = delays.reduce((a, b) => a + b, 0);
      let t = now - span - faker.number.int({ min: 1, max: 30 }) * DAY - faker.number.int({ min: 0, max: 23 }) * HOUR;
      const createdAt = new Date(t);
      const events: SeedEvent[] = [];
      const cvFileName = `CV_${firstName}_${lastName}.pdf`.replace(/\s+/g, "_");

      path.forEach((step, idx) => {
        if (idx > 0) t += delays[idx - 1];
        const at = new Date(t);
        switch (step) {
          case "NEW_CV":
            events.push({ type: "CREATED", title: "Candidat créé", detail: cvFileName, toStatus: step, createdAt: at });
            break;
          case "CV_PARSED":
            events.push({ type: "CV_PARSED", title: "CV extrait", detail: "Texte + nom, email, téléphone, poste", toStatus: step, createdAt: at });
            break;
          case "GPT_ANALYZED":
            events.push({ type: "AI_ANALYZED", title: "Analyse IA", detail: `Score global ${globalScore}/100 · mode démo`, toStatus: step, createdAt: at });
            break;
          case "NOT_ELIGIBLE":
            events.push({ type: "STATUS_CHANGED", title: "Non éligible", detail: "Aucun produit ne correspond au profil", toStatus: step, createdAt: at });
            break;
          case "PRODUCT_MATCHED":
            events.push({ type: "STATUS_CHANGED", title: "Produit associé", detail: product.name, toStatus: step, createdAt: at });
            events.push({ type: "ROUTED", title: "Parcours", detail: trackFromScore(globalScore!, DEFAULT_RULES), createdAt: new Date(t + 1000) });
            break;
          case "EMAIL_1_SENT":
            events.push({ type: "EMAIL_SENT", title: "Email envoyé", detail: EMAIL_SEQUENCE[0], toStatus: step, createdAt: at });
            break;
          case "ENGAGED":
            events.push({ type: "EMAIL_OPENED", title: "Email ouvert", detail: EMAIL_SEQUENCE[0], toStatus: step, createdAt: at });
            events.push({ type: "EMAIL_CLICKED", title: "Lien cliqué", detail: "Voir le programme", createdAt: new Date(t + 3 * 60 * 1000) });
            events.push({ type: "EMAIL_SENT", title: "Email envoyé", detail: EMAIL_SEQUENCE[1], createdAt: new Date(t + 3 * DAY) });
            break;
          case "NURTURE":
            events.push({ type: "EMAIL_SENT", title: "Email envoyé", detail: EMAIL_SEQUENCE[2], createdAt: new Date(t - 2 * DAY) });
            events.push({ type: "STATUS_CHANGED", title: "Recyclage", detail: "Pas de réponse – retour en nurturing", toStatus: step, createdAt: at });
            break;
          case "INTEREST_CONFIRMED":
            events.push({
              type: "EMAIL_REPLIED",
              title: "Réponse reçue",
              detail: faker.helpers.arrayElement([
                "Bonjour, je suis intéressé(e). Quelles sont les options de financement ?",
                "Le programme m'intéresse, quand commence la prochaine session ?",
                "Pouvez-vous m'envoyer le détail du programme et le tarif ?",
              ]),
              toStatus: step,
              createdAt: at,
            });
            break;
          case "OFFER_SENT":
            events.push({ type: "EMAIL_SENT", title: "Offre envoyée", detail: `Offre personnalisée — ${product.name}`, toStatus: step, createdAt: at });
            break;
          case "PRICE_VIEWED":
            events.push({ type: "PRICE_VIEWED", title: "Page prix consultée", detail: product.name, toStatus: step, createdAt: at });
            break;
          case "PURCHASE_READY":
            events.push({ type: "STATUS_CHANGED", title: "Prêt à acheter", detail: "4/4 conditions remplies", toStatus: step, createdAt: at });
            break;
          case "SDR_ASSIGNED":
            events.push({ type: "SDR_ASSIGNED", title: "Assigné à un SDR", detail: sdr!.name, toStatus: step, createdAt: at });
            break;
          case "CALL_COMPLETED":
            events.push({
              type: "CALL_LOGGED",
              title: "Appel de closing",
              detail: `Appel de ${faker.number.int({ min: 15, max: 40 })} min — ${faker.helpers.arrayElement([
                "question sur le financement CPF",
                "hésitation sur le calendrier",
                "très motivé(e), attend le lien de paiement",
              ])}`,
              toStatus: step,
              actorId: sdr!.id,
              createdAt: at,
            });
            break;
          case "WON":
            events.push({
              type: "PAYMENT_CONFIRMED",
              title: "Paiement confirmé",
              detail: `ThriveCart — ${product.name} (${product.price} €)`,
              toStatus: step,
              createdAt: at,
            });
            break;
          case "LOST":
            events.push({ type: "STATUS_CHANGED", title: "Perdu", detail: faker.helpers.arrayElement(LOST_REASONS), toStatus: step, actorId: sdr!.id, createdAt: at });
            break;
        }
      });

      if (sdr && faker.datatype.boolean()) {
        events.push({
          type: "NOTE",
          title: "Note",
          detail: faker.helpers.arrayElement([
            "Préfère être rappelé(e) en fin de journée.",
            "A déjà suivi une formation en ligne, attentif(ve) à l'accompagnement.",
            "Demande une facture au nom de son entreprise.",
          ]),
          actorId: sdr.id,
          createdAt: new Date(t + HOUR),
        });
      }

      const phone = faker.phone.number({ style: "national" });
      const analyzedAt = analyzed ? new Date(createdAt.getTime() + (delays[0] ?? 0) + (delays[1] ?? 0)) : null;
      const skills = faker.helpers.arrayElements(productDef.skills, { min: 3, max: 5 });
      const currentTitle = faker.helpers.arrayElement(productDef.titles);
      const yearsExperience = faker.number.int({ min: 0, max: 15 });
      const city = faker.location.city();
      const education = faker.helpers.arrayElement(EDUCATION);
      const persona = faker.helpers.arrayElement(PERSONAS);

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
          status,
          cvFileName,
          currentTitle: parsed ? currentTitle : null,
          yearsExperience: parsed ? yearsExperience : null,
          education: parsed ? education : null,
          skills: parsed ? skills : [],
          languages: parsed ? faker.helpers.arrayElements(["Français", "Anglais", "Espagnol", "Arabe"], { min: 1, max: 3 }) : [],
          linkedinUrl: parsed ? `https://www.linkedin.com/in/${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, "-") : null,
          cvText: parsed
            ? `${firstName} ${lastName}\n${currentTitle} — ${yearsExperience} ans d'expérience\n${city}\n\nFormation : ${education}\nCompétences : ${skills.join(", ")}`
            : null,
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
          globalScore,
          eligible: analyzed ? !notEligible : null,
          routingTrack: analyzed && !notEligible ? trackFromScore(globalScore!, DEFAULT_RULES) : null,
          analysisState: analyzed ? "DONE" : null,
          analysisMode: analyzed ? "demo" : null,
          analyzedAt,
          recommendedProductId: reached(path, "PRODUCT_MATCHED") ? product.id : null,
          interestConfirmed,
          priceViewed,
          timingDays,
          assignedSdrId: sdr?.id ?? null,
          createdAt,
          updatedAt: new Date(t),
          events: { create: events },
        },
      });
      count++;
    }
  }

  console.log(`Seeded ${count} candidates, ${products.length} products, ${2 + sdrs.length} users.`);
  console.log(`Logins (password demo1234): ${admin.email}, ${sdrs.map((s) => s.email).join(", ")}, ${recruiter.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
