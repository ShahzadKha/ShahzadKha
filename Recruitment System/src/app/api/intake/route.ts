import { after, NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { analyzeCandidate, ingestCv } from "@/lib/engine/pipeline";
import { intakeErrorCode } from "@/lib/engine/errors";
import { CandidateSource } from "@/generated/prisma/enums";

/**
 * Intake API for automated sources: email parser (IMAP), job boards, partners, Activepieces/n8n.
 * Auth: header "Authorization: Bearer <INTAKE_API_KEY>".
 * Body: multipart/form-data with "file" (PDF/DOCX/TXT) or JSON with "cvText";
 * optional fields: source, firstName, lastName, email, phone, city, motivation.
 */
function authorized(request: NextRequest) {
  const key = process.env.INTAKE_API_KEY;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key || !given) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function POST(request: NextRequest) {
  if (!process.env.INTAKE_API_KEY) {
    return NextResponse.json({ error: "intake_disabled" }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let fields: Record<string, unknown>;
  let file: File | null = null;
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const f = form.get("file");
      file = f instanceof File && f.size > 0 ? f : null;
      fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    } else {
      fields = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sourceValue = str(fields.source) as CandidateSource | undefined;
  const source = sourceValue && sourceValue in CandidateSource ? sourceValue : "CSV_IMPORT";
  if (!file && !str(fields.cvText)) return NextResponse.json({ error: "no_file" }, { status: 400 });

  try {
    const result = await ingestCv({
      source,
      file: file ? { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name, mimeType: file.type } : undefined,
      text: str(fields.cvText),
      contact: {
        firstName: str(fields.firstName),
        lastName: str(fields.lastName),
        email: str(fields.email),
        phone: str(fields.phone),
        city: str(fields.city),
      },
      motivation: str(fields.motivation),
    });
    after(() => analyzeCandidate(result.candidateId));
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const code = intakeErrorCode(error);
    return NextResponse.json({ error: code }, { status: code === "unknown" ? 500 : 422 });
  }
}
