import { NextResponse } from "next/server";
import { parseStructuredAiContent } from "../../../../lib/ai-json";

const buckets = new Map();
const MAX_BODY = 20_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 6;
const PROVIDERS = {
  deepseek: { label: "DeepSeek", model: "deepseek-v4-flash", endpoint: "https://api.deepseek.com/chat/completions" },
  openai: { label: "OpenAI", model: "gpt-4o-mini", endpoint: "https://api.openai.com/v1/chat/completions" },
  gemini: { label: "Gemini", model: "gemini-2.0-flash" },
};

function limited(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  const recent = (buckets.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  buckets.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

function cleanText(value, max = 200) {
  return String(value || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, max);
}

function sanitizeBrief(brief) {
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) throw new Error("Brief tidak valid.");
  const result = {
    origin: cleanText(brief.origin), destination: cleanText(brief.destination),
    startDate: cleanText(brief.startDate, 10), endDate: cleanText(brief.endDate, 10),
    purpose: cleanText(brief.purpose, 80), people: Number(brief.people), budget: Number(brief.budget),
  };
  if (!result.origin || !result.destination || !/^\d{4}-\d{2}-\d{2}$/.test(result.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(result.endDate)) throw new Error("Brief belum lengkap.");
  if (result.endDate < result.startDate || !Number.isInteger(result.people) || result.people < 1 || result.people > 10000 || !Number.isFinite(result.budget) || result.budget < 0 || result.budget > 1e15) throw new Error("Nilai brief di luar batas.");
  return result;
}

function normalize(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.activities) || !Array.isArray(data.tasks) || !Array.isArray(data.expenses)) throw new Error("AI mengembalikan struktur yang tidak valid.");
  const activities = data.activities.slice(0, 80).map((item) => ({
    id: crypto.randomUUID(), day: cleanText(item?.day, 40) || "Hari 1", time: cleanText(item?.time, 10) || "09:00",
    title: cleanText(item?.title, 160), note: cleanText(item?.note, 800),
  })).filter((item) => item.title);
  const tasks = data.tasks.slice(0, 120).map((item) => ({ id: crypto.randomUUID(), title: cleanText(item?.title, 250), done: false })).filter((item) => item.title);
  const expenses = data.expenses.slice(0, 80).map((item) => ({ id: crypto.randomUUID(), category: cleanText(item?.category, 200), amount: Math.max(0, Math.round(Number(item?.amount) || 0)) })).filter((item) => item.category);
  if (!activities.length || !tasks.length || !expenses.length) throw new Error("Hasil AI tidak cukup lengkap.");
  return { activities, tasks, expenses };
}

export async function POST(request) {
  if (limited(request)) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi dalam satu menit." }, { status: 429 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return NextResponse.json({ error: "Permintaan terlalu besar." }, { status: 413 });
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY) return NextResponse.json({ error: "Permintaan terlalu besar." }, { status: 413 });
    const body = JSON.parse(rawBody);
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const providerKey = typeof body.provider === "string" ? body.provider.toLowerCase() : "deepseek";
    const provider = PROVIDERS[providerKey];
    if (!provider) return NextResponse.json({ error: "Provider AI tidak didukung." }, { status: 400 });
    if (!apiKey || apiKey.length > 300) return NextResponse.json({ error: `Kunci API ${provider.label} diperlukan.` }, { status: 400 });
    const brief = sanitizeBrief(body.brief);
    const test = body.action === "test";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
      const system = "You are an expert Indonesian travel planner. Return ONLY valid json. RULES: Amounts integer IDR, total MUST NOT exceed budget. Cover EVERY day with 3-5 activities with times (HH:MM). CRITICAL: Routes must be geographically possible (e.g. Depok-Sukabumi needs transit Bogor). Each note: specific location, transport mode, duration, tip. Generate 15-25 tasks: docs, health, packing, bookings, reminders. Expenses 8-15 items: transport, akomodasi, makan, tickets, local transport, tips, insurance, emergency 10%. Use Indonesian. Be specific and practical.";
      const prompt = test ? `Return one short item per array to test connectivity. Context: ${JSON.stringify(brief)}` : `Create a practical itinerary from this sanitized brief: ${JSON.stringify(brief)}`;
      if (providerKey === "gemini") {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: test ? 0 : 0.4, maxOutputTokens: test ? 150 : 8000, responseMimeType: "application/json" },
          }),
        });
      } else {
        response = await fetch(provider.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: provider.model, temperature: test ? 0 : 0.4, max_tokens: test ? 150 : 8000,
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          }),
        });
      }
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const status = [400, 401, 403].includes(response.status) ? 401 : response.status === 429 ? 429 : 502;
      return NextResponse.json({ error: status === 401 ? `Kunci API ditolak ${provider.label}.` : status === 429 ? `Batas ${provider.label} tercapai. Coba lagi nanti.` : `${provider.label} tidak dapat memproses permintaan.` }, { status });
    }
    const payload = await response.json();
    const content = providerKey === "gemini" ? payload?.candidates?.[0]?.content?.parts?.[0]?.text : payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 100_000) throw new Error("Respons AI kosong atau terlalu besar.");
    const result = normalize(parseStructuredAiContent(content));
    return NextResponse.json(test ? { ok: true, provider: providerKey, model: provider.model } : { ...result, provider: providerKey, model: provider.model });
  } catch (error) {
    const message = error?.name === "AbortError" ? "Provider AI melewati batas waktu 25 detik." : error instanceof SyntaxError ? "AI tidak mengembalikan JSON valid." : error.message || "Permintaan AI gagal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
