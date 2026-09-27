import "server-only";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { aiStatus } from "@/lib/settings";
import { ocrWithOpenAI } from "./ocr";

export const MAX_CV_BYTES = 4 * 1024 * 1024; // 4 MB — stays under hosting request limits

export type CvKind = "pdf" | "docx" | "txt" | "jpg" | "png" | "webp";

export const ACCEPTED_CV_TYPES: Record<string, CvKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  // Photos / scans of a CV (read with OpenAI vision)
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// The type we store and serve is derived from what we actually parsed, never from the browser's claim
export const CANONICAL_MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export class CvFileError extends Error {
  constructor(public code: "too_large" | "unsupported" | "empty" | "unreadable" | "needs_ai") {
    super(code);
  }
}

function kindOf(fileName: string, mimeType: string): CvKind | null {
  if (ACCEPTED_CV_TYPES[mimeType]) return ACCEPTED_CV_TYPES[mimeType];
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "jpeg") return "jpg";
  if (ext === "pdf" || ext === "docx" || ext === "txt" || ext === "jpg" || ext === "png" || ext === "webp") return ext;
  return null;
}

// Scanned PDF or image: no text layer, so OpenAI reads it (if configured)
async function readScan(bytes: Uint8Array, kind: CvKind, fileName: string) {
  const ai = aiStatus();
  if (!ai.enabled) throw new CvFileError("needs_ai");
  try {
    return await ocrWithOpenAI(bytes, CANONICAL_MIME[kind].split(";")[0], fileName, ai.model!);
  } catch (e) {
    console.error("OCR failed:", e);
    throw new CvFileError("unreadable");
  }
}

// Step 2–3: get plain text out of a CV file (PDF, Word .docx, .txt, or a scan read by OpenAI)
export async function extractCvText(bytes: Uint8Array, fileName: string, mimeType: string) {
  if (bytes.byteLength > MAX_CV_BYTES) throw new CvFileError("too_large");
  const kind = kindOf(fileName, mimeType);
  if (!kind) throw new CvFileError("unsupported");

  let text = "";
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractPdfText(pdf, { mergePages: true })).text;
    } else if (kind === "jpg" || kind === "png" || kind === "webp") {
      text = ""; // images are read below
    } else if (kind === "docx") {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else {
      text = new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    throw new CvFileError("unreadable");
  }

  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  // Scanned PDFs and photos have no text layer
  if (text.length < 30 && (kind === "pdf" || kind === "jpg" || kind === "png" || kind === "webp")) {
    text = (await readScan(bytes, kind, fileName)).trim();
  }
  if (text.length < 30) throw new CvFileError("empty");
  return { text, kind };
}
