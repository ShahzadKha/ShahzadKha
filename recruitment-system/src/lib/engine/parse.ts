// Step 3 — quick, rule-based extraction of contact details from CV text.
// Good enough for deduplication; the AI analysis then fills in the rest.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+33\s?|0033\s?|0)[1-9](?:[\s.-]?\d{2}){4}|\+\d{1,3}[\s.-]?\d{1,4}(?:[\s.-]?\d{2,4}){2,4}/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i;

export type ParsedContact = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

export function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+33") ? `0${digits.slice(3)}` : digits.startsWith("0033") ? `0${digits.slice(4)}` : digits;
}

// A name line looks like "Marie DUPONT" or "Jean-Pierre Martin": 2–4 words, letters only
function looksLikeName(line: string) {
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4 || line.length > 50) return false;
  return words.every((w) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*$/.test(w));
}

function splitName(line: string) {
  const words = line.trim().split(/\s+/);
  // "DUPONT Marie" → last name written in capitals first
  const upperIdx = words.findIndex((w) => w.length > 1 && w === w.toUpperCase());
  if (upperIdx >= 0) {
    const last = words.filter((w) => w.length > 1 && w === w.toUpperCase());
    const first = words.filter((w) => !(w.length > 1 && w === w.toUpperCase()));
    if (first.length) return { firstName: first.join(" "), lastName: capitalize(last.join(" ")) };
  }
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}

function capitalize(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

export function parseContact(text: string): ParsedContact {
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
  const phone = text.match(PHONE_RE)?.[0]?.trim() ?? null;
  const linkedin = text.match(LINKEDIN_RE)?.[0] ?? null;
  const nameLine = text
    .split("\n")
    .slice(0, 8)
    .map((l) => l.trim())
    .find(looksLikeName);
  const name = nameLine ? splitName(nameLine) : null;

  return {
    firstName: name?.firstName ?? null,
    lastName: name?.lastName ?? null,
    email,
    phone,
    linkedinUrl: linkedin ? (linkedin.startsWith("http") ? linkedin : `https://${linkedin}`) : null,
  };
}
