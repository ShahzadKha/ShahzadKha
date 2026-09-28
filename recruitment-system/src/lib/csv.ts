// Minimal CSV reader: separator detected (; , or tab), quoted fields, UTF-8 BOM.

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Column names accepted for each field (French and English, accents and case ignored)
const HEADERS: Record<string, string[]> = {
  firstName: ["prenom", "firstname", "first"],
  lastName: ["nom", "lastname", "last", "nomdefamille", "surname"],
  email: ["email", "mail", "courriel", "adresseemail", "emailaddress"],
  phone: ["telephone", "tel", "phone", "mobile", "portable"],
  city: ["ville", "city", "localisation", "location"],
  cvText: ["cv", "cvtext", "textecv", "resume", "contenucv", "profil"],
  motivation: ["message", "motivation", "commentaire", "projet"],
  sourceDetail: ["partenaire", "partner", "jobboard", "source", "campagne", "campaign", "origine"],
};

export function mapHeaders(header: string[]) {
  const index: Partial<Record<keyof typeof HEADERS, number>> = {};
  header.forEach((h, i) => {
    const key = (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).find((k) => HEADERS[k].includes(fold(h)));
    if (key && index[key] === undefined) index[key] = i;
  });
  return index;
}
