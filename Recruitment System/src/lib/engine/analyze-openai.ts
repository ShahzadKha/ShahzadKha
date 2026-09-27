import "server-only";
import OpenAI from "openai";
import { AnalysisSchema, type Analysis, type AnalysisInput } from "./analysis";

const nullable = (type: string) => ({ type: [type, "null"] });

// JSON schema for OpenAI structured outputs (strict mode: every field required, no extras)
const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "profile", "persona", "skillGap", "summary", "fitScore", "needScore",
    "intentScore", "eligible", "recommendedProductId", "timingDays",
  ],
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["firstName", "lastName", "currentTitle", "yearsExperience", "education", "city", "skills", "languages"],
      properties: {
        firstName: nullable("string"),
        lastName: nullable("string"),
        currentTitle: nullable("string"),
        yearsExperience: nullable("integer"),
        education: nullable("string"),
        city: nullable("string"),
        skills: { type: "array", items: { type: "string" } },
        languages: { type: "array", items: { type: "string" } },
      },
    },
    persona: { type: "string" },
    skillGap: { type: "string" },
    summary: { type: "string" },
    fitScore: { type: "integer" },
    needScore: { type: "integer" },
    intentScore: { type: "integer" },
    eligible: { type: "boolean" },
    recommendedProductId: nullable("string"),
    timingDays: nullable("integer"),
  },
};

const INSTRUCTIONS = `Tu es le "Sales Copilot" d'un organisme de formation. Tu analyses le CV d'un candidat pour décider quelle formation du catalogue lui vendre.

Réponds uniquement avec le JSON demandé, en français :
- profile : informations extraites du CV (null si absent). skills : 12 compétences maximum. languages : langues parlées.
- persona : une courte étiquette (ex. « Reconversion professionnelle », « Montée en compétences », « Jeune diplômé(e) en recherche d'emploi »).
- skillGap : en une phrase, ce qui manque au candidat pour évoluer.
- summary : 2 à 3 phrases pour un commercial : profil, points forts, pourquoi la formation recommandée.
- fitScore (0–100) : adéquation entre le profil et la meilleure formation du catalogue.
- needScore (0–100) : besoin de formation (projet de reconversion, recherche d'emploi, compétences à mettre à jour).
- intentScore (0–100) : signaux d'intention d'achat (message de motivation, urgence, questions sur prix/financement, source du contact).
- eligible : true si au moins une formation du catalogue correspond raisonnablement au profil.
- recommendedProductId : l'id exact d'une formation du catalogue, ou null si non éligible.
- timingDays : dans combien de jours le candidat souhaite démarrer, si le CV ou le message l'indique, sinon null.

Sois factuel : n'invente aucune information absente du CV.`;

export async function analyzeWithOpenAI(input: AnalysisInput, model: string): Promise<Analysis> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });

  const catalog = input.products
    .map((p) => `- id: ${p.id} | ${p.name} (${p.price} €) — ${p.description ?? ""} | mots-clés : ${p.keywords.join(", ")}`)
    .join("\n");

  const response = await client.responses.create({
    model,
    instructions: INSTRUCTIONS,
    input: [
      `Catalogue des formations :\n${catalog}`,
      `Source du contact : ${input.source}`,
      `Message du candidat : ${input.motivation?.trim() || "(aucun)"}`,
      `CV :\n"""\n${input.cvText.slice(0, 15_000)}\n"""`,
    ].join("\n\n"),
    text: { format: { type: "json_schema", name: "cv_analysis", schema: RESPONSE_SCHEMA, strict: true } },
  });

  const data = AnalysisSchema.parse(JSON.parse(response.output_text));
  // Never trust an id that is not in the catalogue
  if (data.recommendedProductId && !input.products.some((p) => p.id === data.recommendedProductId)) {
    data.recommendedProductId = null;
    data.eligible = false;
  }
  return data;
}
