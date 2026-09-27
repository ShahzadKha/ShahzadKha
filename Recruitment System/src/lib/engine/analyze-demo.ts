// Demo analysis: runs without an OpenAI key. Rule-based and deterministic
// (the same CV always gets the same result), so demos are repeatable.
import type { Analysis, AnalysisInput } from "./analysis";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

const LANGUAGES = ["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Arabe", "Portugais", "Chinois"];

const SOURCE_INTENT: Record<AnalysisInput["source"], number> = {
  WEB_FORM: 60,
  EMAIL: 50,
  MANUAL: 45,
  FILE_DROP: 40,
  CSV_IMPORT: 35,
};

function lines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

const HEADING = /^(profil|resume|experiences?( professionnelles?)?|parcours|formations?|education|diplomes?|competences|skills|langues|languages|centres d'interet|loisirs|interets|contact|certifications?|references)\s*:?$/;
const isHeading = (line: string) => line.length < 40 && HEADING.test(fold(line));

// Lines following a heading such as "Compétences" or "Formation", up to the next heading
function section(text: string, heading: RegExp, max = 4) {
  const all = lines(text);
  const i = all.findIndex((l) => heading.test(fold(l)) && isHeading(l));
  if (i < 0) return [];
  const rest = all.slice(i + 1);
  const end = rest.findIndex(isHeading);
  return rest.slice(0, end < 0 ? max : Math.min(end, max));
}

export function analyzeDemo(input: AnalysisInput): Analysis {
  const raw = `${input.cvText}\n${input.motivation ?? ""}`;
  const text = fold(raw);
  const jitter = (salt: string, range: number) => hash(text + salt) % (range + 1);

  const yearsMatch = text.match(/(\d{1,2})\s*(?:\+\s*)?(?:ans|annees|years)\b/);
  const years = yearsMatch ? Math.min(40, Number(yearsMatch[1])) : null;

  // Product fit: share of the product's keywords found in the CV
  const scored = input.products.map((p) => {
    const matched = p.keywords.filter((k) => text.includes(fold(k)));
    const ratio = p.keywords.length ? matched.length / Math.min(p.keywords.length, 6) : 0;
    const expBonus = years == null ? 0 : Math.min(8, years);
    const fit = matched.length === 0 ? 15 + jitter(p.id, 20) : Math.min(97, Math.round(35 + 55 * Math.min(1, ratio) + expBonus));
    return { product: p, matched, fit };
  });
  scored.sort((a, b) => b.fit - a.fit);
  const best = scored[0];
  const fitScore = best?.fit ?? 20;
  const eligible = Boolean(best && best.matched.length > 0);

  const hasProject = /reconversion|recherche d'emploi|demandeur|objectif|evoluer|me former|formation certifiante|certification|monter en competences/.test(text);
  const needScore = Math.min(95, 50 + (hasProject ? 18 : 0) + (years != null && (years < 3 || years > 8) ? 10 : 0) + jitter("need", 12));

  const hasMotivation = Boolean(input.motivation?.trim());
  const urgent = /rapidement|des que possible|immediatement|disponible|financement|tarif|prix|prochaine session/.test(text);
  const intentScore = Math.min(95, SOURCE_INTENT[input.source] + (hasMotivation ? 15 : 0) + (urgent ? 10 : 0) + jitter("intent", 8));

  const persona = /reconversion/.test(text)
    ? "Reconversion professionnelle"
    : /demandeur d'emploi|recherche d'emploi|en recherche/.test(text)
      ? "Demandeur d'emploi qualifié"
      : years != null && years <= 2
        ? "Jeune diplômé(e) en recherche d'emploi"
        : years != null && years >= 8
          ? "Salarié(e) visant une promotion"
          : "Montée en compétences";

  const all = lines(raw);
  const title =
    all.slice(1, 6).find((l) => l.length < 60 && !l.includes("@") && !/\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/.test(l) && !/\b(19|20)\d{2}\b/.test(l) && !isHeading(l)) ?? null;
  const education =
    section(raw, /^(formation|education|diplomes?)/)[0] ??
    all.find((l) => /\b(master|licence|bts|dut|but|bac|diplome|ecole|universite)\b/.test(fold(l))) ??
    null;
  const skillLines = section(raw, /^(competences|skills)/, 3).join(",");
  const listed = skillLines
    .split(/[,•·|;]/)
    .map((s) => s.replace(/^[-–]\s*/, "").trim())
    .filter((s) => s.length > 1 && s.length < 30);
  // Add matched keywords the candidate did not list themselves ("SEO" is already in "SEO (bases)")
  const extra = (best?.matched ?? []).filter((k) => !listed.some((l) => fold(l).includes(fold(k))));
  const skills = [...new Set([...listed, ...extra])].slice(0, 12);
  const languages = LANGUAGES.filter((l) => text.includes(fold(l)));

  const missing = best ? best.product.keywords.filter((k) => !best.matched.includes(k)).slice(0, 2) : [];
  const skillGap = !eligible
    ? "Profil trop éloigné des formations du catalogue"
    : missing.length
      ? `Manque de pratique en ${missing.join(" et ")}`
      : "Bases solides, à consolider par une certification";

  const who = [title, years != null ? `${years} ans d'expérience` : null].filter(Boolean).join(", ");
  const summary = eligible
    ? `${who || "Profil"} — ${persona.toLowerCase()}. Points forts : ${best!.matched.slice(0, 3).join(", ")}. La formation « ${best!.product.name} » est la plus adaptée pour évoluer vers un poste mieux rémunéré.`
    : `${who || "Profil"}. Aucune formation du catalogue ne correspond suffisamment à ce parcours pour le moment.`;

  return {
    profile: {
      firstName: null,
      lastName: null,
      currentTitle: title,
      yearsExperience: years,
      education,
      city: null,
      skills,
      languages,
    },
    persona,
    skillGap,
    summary,
    fitScore,
    needScore,
    intentScore,
    eligible,
    recommendedProductId: eligible ? best!.product.id : null,
    timingDays: /immediatement|des que possible|disponible/.test(text) ? 14 : null,
  };
}
