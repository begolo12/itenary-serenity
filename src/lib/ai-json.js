import { jsonrepair } from "jsonrepair";

export function parseStructuredAiContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new SyntaxError("Respons AI kosong.");
  }

  const trimmed = content.trim().replace(/^\uFEFF/, "");
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");
  const candidates = [withoutFence];

  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(withoutFence.slice(objectStart, objectEnd + 1));
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate);
      const decoded = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) return decoded;
    } catch {
      // Try the next strict JSON candidate without guessing or mutating values.
    }
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      const repaired = JSON.parse(jsonrepair(candidate));
      if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) return repaired;
    } catch {
      // The provider repair request is the final fallback.
    }
  }

  throw new SyntaxError("AI tidak mengembalikan JSON valid.");
}
