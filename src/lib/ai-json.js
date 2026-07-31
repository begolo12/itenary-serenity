import { jsonrepair } from "jsonrepair";

export function parseStructuredAiContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new SyntaxError("Respons AI kosong.");
  }

  const cleaned = content
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const fenceContent = fenceMatch ? fenceMatch[1].trim() : null;

  const withoutFence = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const slicedObject = (objectStart >= 0 && objectEnd > objectStart)
    ? cleaned.slice(objectStart, objectEnd + 1)
    : null;

  const rawCandidates = [fenceContent, slicedObject, withoutFence, cleaned].filter(Boolean);
  const candidates = [...new Set(rawCandidates)];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const decoded = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) return decoded;
    } catch {
      // Try next candidate
    }
  }

  for (const candidate of candidates) {
    try {
      const repaired = JSON.parse(jsonrepair(candidate));
      if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) return repaired;
    } catch {
      // Try next candidate
    }
  }

  throw new SyntaxError("AI tidak mengembalikan JSON valid.");
}
