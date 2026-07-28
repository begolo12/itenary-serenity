import { PLAN_TYPES, PLAN_TYPE_LABELS, parsePlan } from "./schemas/plan.js";
export const STORAGE_KEY = "serenity-itinerary-mvp";

export const blankTrip = {
  planType: "trip",
  origin: "Jakarta",
  destination: "",
  locations: [],
  startDate: "",
  endDate: "",
  people: "2",
  purpose: "Leisure",
  participants: { total: 2, adults: 2, children: 0, seniors: 0, accessibility: "" },
  budget: "5000000",
  budgetMode: "total",
  currency: "IDR",
  venue: "",
  meetingPoint: "",
  timezone: "Asia/Jakarta",
  tripMode: "overnight",
  roomMode: "single",
  departureWindow: "morning",
  travelPace: "balanced",
  interests: "",
  transportPreference: "mixed",
  accommodationPreference: "hotel",
  dietaryPreference: "none",
  mustDo: "",
  avoid: "",
  specialNeeds: "",
  summary: "",
  highlights: [],
  travelGuide: { transport: "", accommodation: "", food: "", weather: "", safety: "", tips: "" },
  documents: [],
};

export function validateTrip(form, { allowDestinationRecommendation = false } = {}) {
  const destinationRequired = allowDestinationRecommendation || Boolean(form.destination?.trim()) || Boolean(form.venue?.trim()) || Boolean(form.locations?.length);
  if (!form.origin?.trim() || !destinationRequired || !form.startDate || !form.endDate) {
    return "Asal, tujuan/venue, dan tanggal wajib diisi.";
  }
  if (form.endDate < form.startDate) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (!["day_trip", "overnight"].includes(form.tripMode)) return "Pilih tipe perjalanan.";
  if (form.tripMode === "day_trip" && form.startDate !== form.endDate) return "Day trip harus memakai tanggal mulai dan selesai yang sama.";
  if (form.tripMode === "overnight" && !["single", "separate"].includes(form.roomMode)) return "Pilih pengaturan room.";
  if (!Number.isFinite(Number(form.people)) || Number(form.people) < 1) return "Jumlah orang minimal 1.";
  if (!Number.isFinite(Number(String(form.budget).replace(/[^0-9]/g, ""))) || Number(String(form.budget).replace(/[^0-9]/g, "")) < 0) return "Anggaran tidak boleh negatif.";
  return "";
}

export function createTemplate(form) {
  const destination = String(form.destination || "").trim();
  const destinationLabel = destination || String(form.venue || "").trim() || "destinasi rekomendasi AI";
  const budget = Number(String(form.budget || 0).replace(/[^0-9]/g, ""));
  const estimateBudget = form.budgetMode === "per_person" ? budget * Math.max(1, Number(form.people || 1)) : budget;
  const now = new Date().toISOString();
  const dayTrip = form.tripMode === "day_trip";
  const interests = String(form.interests || "").split(",").map((item) => item.trim()).filter(Boolean);
  const planType = PLAN_TYPES.includes(form.planType) ? form.planType : "trip";
  const planTypeLabel = PLAN_TYPE_LABELS[planType];
  const activity = (day, time, title, note, extra = {}) => ({
    id: crypto.randomUUID(), day, time, title, note,
    location: destinationLabel, duration: "90 menit", transport: form.transportPreference || "mixed",
    estimatedCost: 0, category: "Aktivitas", bookingNote: "", done: false, ...extra,
  });
  const templateActivities = (() => {
    if (planType === "business") return [
      activity("Hari 1", "08:30", "Registrasi dan persiapan agenda", `Tiba di ${destinationLabel} dan siapkan materi.`, { category: "Operasional" }),
      activity("Hari 1", "10:00", "Sesi utama / meeting", "Sisakan jeda untuk keputusan dan tindak lanjut.", { duration: "3 jam", category: "Meeting", estimatedCost: Math.round(estimateBudget * 0.2) }),
      activity("Hari 1", "16:00", "Review hasil dan perjalanan pulang", "Catat keputusan, PIC, dan deadline setelah meeting.", { category: "Penutupan" }),
    ];
    if (planType === "gathering") return [
      activity("Hari 1", "09:00", "Kumpul dan registrasi peserta", `Titik kumpul: ${form.meetingPoint || destinationLabel}.`, { category: "Peserta" }),
      activity("Hari 1", "10:00", "Aktivitas gathering utama", "Pandu peserta mengikuti rundown dan jaga buffer waktu.", { duration: "4 jam", category: "Program", estimatedCost: Math.round(estimateBudget * 0.35) }),
      activity("Hari 1", "16:00", "Foto bersama dan penutupan", "Pastikan barang, dokumentasi, dan peserta terdata.", { category: "Penutupan" }),
    ];
    if (planType === "study_tour") return [
      activity("Hari 1", "07:00", "Briefing peserta dan pembagian kelompok", "Cek kehadiran, kontak darurat, dan aturan lokasi.", { category: "Edukasi" }),
      activity("Hari 1", "09:00", "Kunjungan lokasi pembelajaran", `Sesi observasi di ${destinationLabel}.`, { duration: "4 jam", category: "Kunjungan", estimatedCost: Math.round(estimateBudget * 0.25) }),
      activity("Hari 1", "15:00", "Refleksi dan perjalanan kembali", "Kumpulkan catatan belajar dan evaluasi pendamping.", { category: "Evaluasi" }),
    ];
    if (planType === "community_event") return [
      activity("Hari 1", "07:00", "Setup venue dan perlengkapan", `Siapkan venue ${form.venue || destinationLabel}.`, { category: "Produksi" }),
      activity("Hari 1", "10:00", "Program acara komunitas", "Pastikan moderator, konsumsi, dan jalur komunikasi aktif.", { duration: "4 jam", category: "Program", estimatedCost: Math.round(estimateBudget * 0.4) }),
      activity("Hari 1", "15:00", "Beres-beres dan evaluasi", "Inventaris perlengkapan dan catat tindak lanjut.", { category: "Penutupan" }),
    ];
    return dayTrip ? [
      activity("Hari 1", "09:00", `Tiba dan orientasi ${destinationLabel}`, `Berangkat dari ${form.origin}.`, { duration: "90 menit", category: "Transportasi" }),
      activity("Hari 1", "13:00", "Makan siang dan aktivitas utama", `Disusun untuk ${String(form.purpose || "perjalanan").toLowerCase()}.`, { duration: "3 jam", category: "Kuliner & aktivitas", estimatedCost: Math.round(estimateBudget * 0.2) }),
      activity("Hari 1", "17:00", "Perjalanan pulang", "Sisakan waktu untuk perjalanan kembali.", { duration: "90 menit", category: "Transportasi" }),
    ] : [
      activity("Hari 1", "09:00", `Tiba dan orientasi ${destinationLabel}`, `Berangkat dari ${form.origin}.`, { duration: "90 menit", category: "Transportasi" }),
      activity("Hari 1", "13:00", "Makan siang dan check-in", `Konfirmasi akomodasi ${form.roomMode === "separate" ? "dengan room terpisah" : "satu room"}.`, { duration: "2 jam", category: "Akomodasi & kuliner", estimatedCost: Math.round(estimateBudget * 0.15) }),
      activity("Hari 2", "10:00", "Aktivitas utama", `Sesuaikan dengan minat: ${interests.join(", ") || "fleksibel"}.`, { duration: "4 jam", category: "Aktivitas", estimatedCost: Math.round(estimateBudget * 0.2) }),
    ];
  })();
  const seedTask = (title, category, note, priority = "sedang", phase = "before", due = form.startDate) => ({ id: crypto.randomUUID(), title, category, priority, due: due || "", note, done: false, status: "todo", phase, dependencies: [] });
  const seedExpense = (category, description, amount, note) => ({ id: crypto.randomUUID(), category, description, amount: Math.round(estimateBudget * amount), paid: false, note, verificationStatus: "estimated" });
  const seedDocument = (type, title, note) => ({ id: crypto.randomUUID(), type, title, status: "Perlu dicek", number: "", note });
  const isTripPlan = planType === "trip";
  const templateTasks = isTripPlan
    ? [
      seedTask("Pesan transportasi", "Sebelum berangkat", "Bandingkan waktu tempuh dan kebijakan pembatalan.", "tinggi"),
      ...(!dayTrip ? [seedTask("Konfirmasi akomodasi", "Sebelum berangkat", `Pastikan ${form.roomMode === "separate" ? "room terpisah" : "satu room"} dan jam check-in.`, "tinggi")] : []),
      seedTask("Siapkan dokumen perjalanan", "Dokumen", "Bawa identitas dan bukti reservasi jika ada.", "tinggi"),
      seedTask("Cek cuaca dan kondisi rute", "Keamanan", "Sesuaikan pakaian dan rencana cadangan."),
    ]
    : [
      seedTask("Konfirmasi tujuan, venue, dan PIC", "Persiapan", "Pastikan titik kumpul, kontak PIC, dan jalur eskalasi.", "tinggi"),
      seedTask("Kirim rundown dan data peserta", "Komunikasi", "Bagikan jadwal, kebutuhan khusus, dan kontak penting.", "tinggi"),
      seedTask("Cek perlengkapan, izin, dan rencana cadangan", "Operasional", "Verifikasi perlengkapan, akses venue, dan mitigasi risiko.", "tinggi"),
      seedTask("Catat hasil dan tindak lanjut", "Sesudah kegiatan", "Dokumentasikan keputusan, biaya aktual, dan pekerjaan lanjutan.", "sedang", "after", form.endDate || form.startDate),
    ];
  const templateExpenses = isTripPlan
    ? [
      seedExpense("Transportasi", "Transportasi utama dan perpindahan lokal", 0.35, "Estimasi; verifikasi harga aktual."),
      ...(!dayTrip ? [seedExpense("Akomodasi", "Penginapan sesuai preferensi", 0.4, "Estimasi; belum termasuk biaya tambahan.")] : []),
      seedExpense("Makan & aktivitas", "Kuliner, tiket, dan aktivitas", dayTrip ? 0.65 : 0.25, "Sisakan dana cadangan dari budget."),
    ]
    : [
      seedExpense("Venue & produksi", "Venue, perlengkapan, dan kebutuhan teknis", 0.35, "Estimasi; konfirmasi kapasitas dan biaya tambahan."),
      seedExpense("Konsumsi & peserta", "Makanan, minuman, dan kebutuhan peserta", 0.4, "Estimasi; sesuaikan dengan jumlah peserta dan pantangan."),
      seedExpense("Logistik & cadangan", "Transportasi lokal, dokumentasi, dan dana cadangan", 0.25, "Estimasi; simpan bukti pembayaran."),
    ];
  const templateDocuments = isTripPlan
    ? [
      seedDocument("Identitas", "KTP / paspor peserta", "Pastikan masa berlaku masih aktif."),
      seedDocument("Reservasi", "Bukti transportasi dan akomodasi", "Tambahkan nomor booking setelah dipesan."),
    ]
    : [
      seedDocument("Peserta", "Daftar peserta dan kontak PIC", "Lengkapi kebutuhan khusus dan kontak darurat."),
      seedDocument("Operasional", "Rundown dan izin venue", "Pastikan versi terbaru disetujui pihak terkait."),
    ];
  const plan = {
    ...form,
    id: crypto.randomUUID(),
    title: planType === "trip" ? `${form.purpose} di ${destinationLabel}` : `${planTypeLabel}: ${form.purpose} · ${form.venue || destinationLabel}`,
    summary: `${planTypeLabel} ${String(form.purpose || "kegiatan").toLowerCase()} dari ${form.origin} menuju ${destinationLabel}, disusun untuk ${form.people} peserta${form.travelPace ? ` dengan tempo ${form.travelPace}` : ""}.`,
    highlights: interests,
    facts: [`Asal: ${form.origin}`, `${form.venue || "Tujuan"}: ${destinationLabel}`, `Peserta: ${form.people}`, `Tanggal: ${form.startDate}–${form.endDate}`],
    assumptions: ["Harga, kapasitas venue, jam operasional, dan waktu tempuh masih berupa estimasi."],
    verificationNotes: ["Verifikasi reservasi, harga aktual, aksesibilitas, izin, dan rencana pulang sebelum pelaksanaan."],
    conflicts: [],
    alternatives: form.venue ? [`Siapkan venue alternatif jika ${form.venue} tidak tersedia.`] : ["Siapkan lokasi alternatif jika destinasi utama tidak tersedia."],
    planType,
    planTypeLabel,
    locations: form.locations?.length ? form.locations : [
      ...(form.origin ? [{ name: form.origin, kind: "origin" }] : []),
      ...(destination ? [{ name: destination, kind: "destination" }] : []),
    ],
    travelGuide: {
      transport: `Gunakan ${form.transportPreference || "transportasi campuran"} dan sisakan buffer perpindahan.`,
      accommodation: dayTrip ? "Tidak memerlukan akomodasi." : `Cari ${form.accommodationPreference || "hotel"} sesuai budget dan kebutuhan room.`,
      food: form.dietaryPreference === "none" ? "Pilih tempat makan lokal dengan ulasan baik." : `Perhatikan preferensi makanan: ${form.dietaryPreference}.`,
      weather: "Cek prakiraan cuaca 2–3 hari sebelum berangkat.",
      safety: "Verifikasi jam operasional, rute pulang, dan kondisi lokal sebelum berangkat.",
      tips: form.specialNeeds || "Simpan kontak penting, dokumen, dan dana cadangan.",
    },
    people: Number(form.people),
    participants: {
      total: Number(form.people),
      adults: Number(form.participants?.adults ?? form.people),
      children: Number(form.participants?.children ?? 0),
      seniors: Number(form.participants?.seniors ?? 0),
      accessibility: form.participants?.accessibility || form.specialNeeds || "",
    },
    budgetMode: form.budgetMode || "total",
    currency: form.currency || "IDR",
    venue: form.venue || "",
    meetingPoint: form.meetingPoint || "",
    timezone: form.timezone || "Asia/Jakarta",
    budget,
    status: "draft",
    source: "template",
    createdAt: now,
    updatedAt: now,
    photo: null,
    risks: [],
    notes: form.agendaNotes || "",
    generation: { status: "local", provider: "", model: "", generatedAt: now, verifiedAt: "" },
    activities: templateActivities,
    tasks: templateTasks,
    expenses: templateExpenses,
    documents: templateDocuments,
  };
  return parsePlan(plan);
}

export const CURRENCY_KEY = "serenity-currency";
const CURRENCIES = { IDR: "id-ID", USD: "en-US", SGD: "en-SG", MYR: "ms-MY" };
export const CURRENCY_LIST = Object.keys(CURRENCIES);

export const rupiah = (value, currency) => {
  const cur = currency || (typeof localStorage !== "undefined" && localStorage.getItem(CURRENCY_KEY)) || "IDR";
  const locale = CURRENCIES[cur] || "id-ID";
  return new Intl.NumberFormat(locale, {
    style: "currency", currency: cur, maximumFractionDigits: 0,
  }).format(Number(value || 0));
};
export const effectiveBudget = (plan) => {
  const budget = Number(plan?.budget || 0);
  if (plan?.budgetMode === "per_person") return budget * Math.max(1, Number(plan.people || plan.participants?.total || 1));
  return budget;
};

export const dateLabel = (value) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`))
  : "Belum ditentukan";

function download(filename, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  download(filename, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

const icsEscape = (value) => String(value || "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");

export function downloadIcs(trip) {
  const start = new Date(`${trip.startDate}T00:00:00`);
  const events = trip.activities.map((activity) => {
    const day = Math.max(1, Number(activity.day?.match(/\d+/)?.[0] || 1));
    const date = new Date(start);
    date.setDate(date.getDate() + day - 1);
    const [hour, minute] = String(activity.time || "09:00").replace(".", ":").split(":").map(Number);
    date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
    const end = new Date(date.getTime() + 60 * 60 * 1000);
    const stamp = (value) => value.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}/, "");
    return ["BEGIN:VEVENT", `UID:${activity.id}@serenity-itinerary`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(date)}`, `DTEND:${stamp(end)}`, `SUMMARY:${icsEscape(activity.title)}`, `DESCRIPTION:${icsEscape(activity.note)}`, "END:VEVENT"].join("\r\n");
  });
  download(`${trip.destination || "serenity"}.ics`, ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Serenity Itinerary//ID", ...events, "END:VCALENDAR"].join("\r\n"), "text/calendar;charset=utf-8");
}
