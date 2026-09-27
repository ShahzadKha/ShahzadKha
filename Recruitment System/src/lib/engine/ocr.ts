import "server-only";
import OpenAI from "openai";

/**
 * Reads the text of a scanned CV (PDF made of images, or a photo) with OpenAI vision.
 * Only used when the file has no text layer and an OpenAI key is configured.
 */
export async function ocrWithOpenAI(bytes: Uint8Array, mimeType: string, fileName: string, model: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 1 });
  const b64 = Buffer.from(bytes).toString("base64");
  const file =
    mimeType === "application/pdf"
      ? { type: "input_file" as const, filename: fileName, file_data: `data:application/pdf;base64,${b64}` }
      : { type: "input_image" as const, image_url: `data:${mimeType};base64,${b64}`, detail: "high" as const };

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Voici un CV scanné. Recopie fidèlement tout son texte (nom, coordonnées, expériences, formations, compétences, langues), en texte brut, sans commentaire ni mise en forme.",
          },
          file,
        ],
      },
    ],
  });
  return response.output_text.trim();
}
