import "server-only";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_CV_BYTES = 4 * 1024 * 1024; // 4 MB — stays under hosting request limits

export const ACCEPTED_CV_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

// The type we store and serve is derived from what we actually parsed, never from the browser's claim
export const CANONICAL_MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
} as const;

export class CvFileError extends Error {
  constructor(public code: "too_large" | "unsupported" | "empty" | "unreadable") {
    super(code);
  }
}

function kindOf(fileName: string, mimeType: string) {
  if (ACCEPTED_CV_TYPES[mimeType]) return ACCEPTED_CV_TYPES[mimeType];
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
  return null;
}

// Step 2–3: get plain text out of a CV file (PDF, Word .docx or .txt)
export async function extractCvText(bytes: Uint8Array, fileName: string, mimeType: string) {
  if (bytes.byteLength > MAX_CV_BYTES) throw new CvFileError("too_large");
  const kind = kindOf(fileName, mimeType);
  if (!kind) throw new CvFileError("unsupported");

  let text = "";
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractPdfText(pdf, { mergePages: true })).text;
    } else if (kind === "docx") {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else {
      text = new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    throw new CvFileError("unreadable");
  }

  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  // Scanned PDFs contain images only; they would need OCR
  if (text.length < 30) throw new CvFileError("empty");
  return { text, kind };
}
