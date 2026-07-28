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
  const destination = cleanText(brief.destination);
  const result = {
    origin: cleanText(brief.origin), destination,
    startDate: cleanText(brief.startDate, 10), endDate: cleanText(brief.endDate, 10),
    purpose: cleanText(brief.purpose, 80), people: Number(brief.people), budget: Number(brief.budget),
    tripMode: brief.tripMode === "day_trip" ? "day_trip" : "overnight",
    roomMode: brief.roomMode === "separate" ? "separate" : "single",
    recommendDestination: Boolean(brief.recommendDestination) && !destination,
  };
  if (!result.origin || (!result.destination && !result.recommendDestination) || !/^\d{4}-\d{2}-\d{2}$/.test(result.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(result.endDate)) throw new Error("Brief belum lengkap.");
  if (result.endDate < result.startDate || !Number.isInteger(result.people) || result.people < 1 || result.people > 10000 || !Number.isFinite(result.budget) || result.budget < 0 || result.budget > 1e15) throw new Error("Nilai brief di luar batas.");
  if (result.tripMode === "day_trip" && result.startDate !== result.endDate) throw new Error("Day trip harus memakai tanggal yang sama.");
  return result;
}

function normalize(data, brief) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`AI mengembalikan struktur yang tidak valid: ${JSON.stringify(Object.keys(data || {}))}`);
  const root = data.itinerary || data.data || data.trip || data.response || data.result || data;
  if (!Array.isArray(root.activities) || !Array.isArray(root.tasks) || !Array.isArray(root.expenses)) throw new Error(`AI mengembalikan struktur yang tidak valid: kunci "${Object.keys(root).join('", "')}" tidak memiliki activities/tasks/expenses sebagai array.`);
  const destination = cleanText(root.destination, 240) || brief.destination;
  if (!destination) throw new Error("AI belum mengembalikan destinasi rekomendasi.");
  const activities = root.activities.slice(0, 80).map((item) => ({
    id: crypto.randomUUID(), day: cleanText(item?.day, 40) || "Hari 1", time: cleanText(item?.time, 10) || "09:00",
    title: cleanText(item?.title, 160), note: cleanText(item?.note, 800),
  })).filter((item) => item.title);
  const tasks = root.tasks.slice(0, 120).map((item) => ({ id: crypto.randomUUID(), title: cleanText(item?.title, 250), done: false })).filter((item) => item.title);
  const expenses = root.expenses.slice(0, 80).map((item) => ({ id: crypto.randomUUID(), category: cleanText(item?.category, 200), amount: Math.max(0, Math.round(Number(item?.amount) || 0)) })).filter((item) => item.category);
  if (!activities.length || !tasks.length || !expenses.length) throw new Error("Hasil AI tidak cukup lengkap.");
  return {
    title: cleanText(root.title, 180) || `${brief.purpose} di ${destination}`,
    destination,
    recommendationNote: cleanText(root.recommendationNote, 600),
    activities, tasks, expenses,
  };
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
    if (brief.recommendDestination && providerKey !== "gemini") return NextResponse.json({ error: "Untuk rekomendasi destinasi online, pilih provider Gemini." }, { status: 400 });
    const test = body.action === "test";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
       const system = "Anda adalah asisten itinerary Indonesia. Kembalikan JSON valid dengan struktur ini (tanpa markdown dan tanpa key wrapper):\n{\n  \"title\": \"Judul itinerary\",\n  \"destination\": \"Destinasi atau rute final\",\n  \"recommendationNote\": \"Alasan singkat rekomendasi jika destinasi dipilih AI\",\n  \"activities\": [{ \"day\": \"Hari 1\", \"time\": \"09:00\", \"title\": \"Nama aktivitas\", \"note\": \"Lokasi, transport, durasi, tip\" }],\n  \"tasks\": [{ \"title\": \"Nama tugas\" }],\n  \"expenses\": [{ \"category\": \"Transport\", \"amount\": 500000 }]\n}\n\nRULES: Amounts integer IDR, total MUST NOT exceed budget. activities: 3-5 per day with times (HH:MM), sesuai jumlah hari dan tipe perjalanan. Untuk day_trip jangan membuat aktivitas menginap. Untuk overnight wajib memasukkan akomodasi dan detail roomMode (single berarti satu room, separate berarti room terpisah). CRITICAL: geographically possible routes. tasks: 15-25 items (docs, health, packing, bookings, reminders). expenses: 8-15 items (transport, akomodasi jika menginap, makan, tickets, local transport, tips, insurance, emergency 10%). Gunakan Bahasa Indonesia.";
       const prompt = test ? `Return one short item per array to test connectivity. Context: ${JSON.stringify(brief)}` : brief.recommendDestination ? `Cari rekomendasi destinasi terkini dengan Google Search. Pilih destinasi yang realistis berdasarkan asal, tanggal, budget, jumlah orang, tujuan perjalanan, dan tipe perjalanan. Kembalikan destinasi final, alasan singkat, lalu susun itinerary lengkap. Brief: ${JSON.stringify(brief)}` : `Create a practical complete itinerary from this sanitized brief and follow the destination/route exactly: ${JSON.stringify(brief)}`;
      if (providerKey === "gemini") {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
             generationConfig: { temperature: test ? 0 : 0.4, maxOutputTokens: test ? 150 : 8000, responseMimeType: "application/json" },
             ...(brief.recommendDestination ? { tools: [{ google_search: {} }] } : {}),
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
    let parsed;
    try {
      parsed = parseStructuredAiContent(content);
    } catch {
      throw new SyntaxError(`AI tidak mengembalikan JSON valid. Respons: ${content.slice(0, 500)}`);
    }
     const result = normalize(parsed, brief);
     return NextResponse.json(test ? { ok: true, provider: providerKey, model: provider.model } : { ...result, ...(brief.recommendDestination ? { recommendationSource: "Gemini Google Search" } : {}), provider: providerKey, model: provider.model });
  } catch (error) {
    const message = error?.name === "AbortError" ? "Provider AI melewati batas waktu 25 detik." : error.message || "Permintaan AI gagal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
