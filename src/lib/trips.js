export const STORAGE_KEY = "serenity-itinerary-mvp";

export const blankTrip = {
  origin: "Jakarta",
  destination: "",
  startDate: "",
  endDate: "",
  people: "2",
  purpose: "Leisure",
  budget: "5000000",
};

export function validateTrip(form) {
  if (!form.origin?.trim() || !form.destination?.trim() || !form.startDate || !form.endDate) {
    return "Asal, tujuan, dan tanggal wajib diisi.";
  }
  if (form.endDate < form.startDate) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (!Number.isFinite(Number(form.people)) || Number(form.people) < 1) return "Jumlah orang minimal 1.";
  if (!Number.isFinite(Number(String(form.budget).replace(/[^0-9]/g, ""))) || Number(String(form.budget).replace(/[^0-9]/g, "")) < 0) return "Anggaran tidak boleh negatif.";
  return "";
}

export function createTemplate(form) {
  const destination = form.destination.trim();
  const budget = Number(String(form.budget || 0).replace(/[^0-9]/g, ""));
  const now = new Date().toISOString();
  return {
    ...form,
    id: crypto.randomUUID(),
    title: `${form.purpose} di ${destination}`,
    people: Number(form.people),
    budget,
    status: "draft",
    source: "template",
    createdAt: now,
    updatedAt: now,
    photo: null,
    activities: [
      { id: crypto.randomUUID(), day: "Hari 1", time: "09:00", title: `Tiba dan orientasi ${destination}`, note: `Berangkat dari ${form.origin}.` },
      { id: crypto.randomUUID(), day: "Hari 1", time: "13:00", title: "Makan siang dan check-in", note: "Konfirmasi akomodasi sebelum berangkat." },
      { id: crypto.randomUUID(), day: "Hari 2", time: "10:00", title: "Aktivitas utama", note: `Disusun untuk perjalanan ${form.purpose.toLowerCase()}.` },
    ],
    tasks: [
      { id: crypto.randomUUID(), title: "Pesan transportasi", done: false },
      { id: crypto.randomUUID(), title: "Konfirmasi akomodasi", done: false },
      { id: crypto.randomUUID(), title: "Siapkan dokumen perjalanan", done: false },
    ],
    expenses: [
      { id: crypto.randomUUID(), category: "Transportasi", amount: Math.round(budget * 0.35) },
      { id: crypto.randomUUID(), category: "Akomodasi", amount: Math.round(budget * 0.4) },
      { id: crypto.randomUUID(), category: "Makan & aktivitas", amount: Math.round(budget * 0.25) },
    ],
  };
}

export const rupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(Number(value || 0));

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
