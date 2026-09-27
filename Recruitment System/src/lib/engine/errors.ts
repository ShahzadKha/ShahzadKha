import { CvFileError } from "./extract";
import { IngestError } from "./pipeline";

export type IntakeErrorCode = "too_large" | "unsupported" | "empty" | "unreadable" | "no_email" | "no_name" | "no_file" | "unknown";

export function intakeErrorCode(error: unknown): IntakeErrorCode {
  if (error instanceof CvFileError || error instanceof IngestError) return error.code;
  console.error("CV intake failed:", error);
  return "unknown";
}
