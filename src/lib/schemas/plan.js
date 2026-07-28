import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus memakai format YYYY-MM-DD");
const optionalText = (max) => z.string().trim().max(max).optional().default("");
export const PLAN_TYPES = ["trip", "business", "gathering", "study_tour", "community_event", "custom"];
export const PLAN_TYPE_LABELS = {
  trip: "Liburan pribadi",
  business: "Perjalanan dinas",
  gathering: "Gathering / outing",
  study_tour: "Study tour",
  community_event: "Acara komunitas",
  custom: "Kustom",
};
export const CURRENCIES = ["IDR", "USD", "SGD", "MYR"];
const planTypeSchema = z.enum(PLAN_TYPES);
const currencySchema = z.enum(CURRENCIES);
const participantProfileSchema = z.object({
  total: z.coerce.number().int().min(1).max(10_000).default(1),
  adults: z.coerce.number().int().min(0).max(10_000).default(0),
  children: z.coerce.number().int().min(0).max(10_000).default(0),
  seniors: z.coerce.number().int().min(0).max(10_000).default(0),
  accessibility: optionalText(600),
}).default({});
const locationSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(240),
  kind: z.enum(["origin", "destination", "venue", "meeting_point", "stop"]).default("destination"),
  note: optionalText(300),
}).passthrough();

export const briefSchema = z.object({
  origin: z.string().trim().min(1).max(160),
  planType: planTypeSchema.default("trip"),
  destination: z.string().trim().max(240).default(""),
  startDate: date,
  locations: z.array(locationSchema).max(12).default([]),
  endDate: date,
  purpose: z.string().trim().min(1).max(100),
  people: z.coerce.number().int().min(1).max(10_000),
  budget: z.coerce.number().finite().min(0).max(1e15),
  participants: participantProfileSchema,
  budgetMode: z.enum(["total", "per_person", "open"]).default("total"),
  currency: currencySchema.default("IDR"),
  venue: optionalText(240),
  meetingPoint: optionalText(240),
  timezone: optionalText(80),
  tripMode: z.enum(["day_trip", "overnight"]),
  roomMode: z.enum(["single", "separate"]),
  departureWindow: z.enum(["early", "morning", "afternoon", "evening"]),
  travelPace: z.enum(["relaxed", "balanced", "packed"]),
  interests: optionalText(400),
  transportPreference: z.enum(["mixed", "private_car", "public", "ride_hailing", "walking"]),
  accommodationPreference: z.enum(["hotel", "boutique", "villa", "budget", "family"]),
  dietaryPreference: z.enum(["none", "halal", "vegetarian", "vegan", "custom"]),
  mustDo: optionalText(500),
  avoid: optionalText(400),
  specialNeeds: optionalText(600),
  agendaNotes: optionalText(800),
  recommendDestination: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.endDate < value.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
  if (value.tripMode === "day_trip" && value.startDate !== value.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Day trip harus memakai tanggal yang sama." });
  if (!value.destination && !value.locations.length && !value.venue && !value.recommendDestination) context.addIssue({ code: "custom", path: ["destination"], message: "Tujuan, venue, atau rekomendasi AI wajib diisi." });
});

export const activitySchema = z.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const hasStatus = Object.prototype.hasOwnProperty.call(input, "status");
  return hasStatus ? { ...input, done: input.status === "done" } : { ...input, status: input.done ? "done" : "planned" };
}, z.object({
  id: z.string().min(1),
  day: z.string().trim().min(1).max(40),
  time: z.string().trim().min(1).max(10),
  date: date.optional(),
  startTime: z.string().trim().max(10).optional(),
  endTime: z.string().trim().max(10).optional(),
  title: z.string().trim().min(1).max(240),
  note: optionalText(800),
  location: optionalText(240),
  duration: optionalText(60),
  transport: optionalText(120),
  category: z.string().trim().min(1).max(100).default("Aktivitas"),
  estimatedCost: z.number().finite().min(0).max(1e15).default(0),
  bookingNote: optionalText(300),
  done: z.boolean().default(false),
  locked: z.boolean().default(false),
  picId: optionalText(120),
  status: z.enum(["planned", "confirmed", "done", "cancelled"]).default("planned"),
  assigneeId: optionalText(120),
  dependencies: z.array(z.string().min(1)).max(100).default([]),
}).passthrough());

export const taskSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const hasStatus = Object.prototype.hasOwnProperty.call(input, "status");
  return hasStatus ? { ...input, done: input.status === "done" } : { ...input, status: input.done ? "done" : "todo" };
}, z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(250),
  category: z.string().trim().min(1).max(100).default("Umum"),
  priority: z.enum(["tinggi", "sedang", "rendah"]).default("sedang"),
  due: z.string().max(40).default(""),
  phase: z.enum(["before", "during", "after"]).default("before"),
  note: optionalText(500),
  done: z.boolean().default(false),
  locked: z.boolean().default(false),
  assigneeId: optionalText(120),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).default("todo"),
  dependencies: z.array(z.string().min(1)).max(100).default([]),
}).passthrough());

export const expenseSchema = z.object({
  id: z.string().min(1),
  category: z.string().trim().min(1).max(200),
  description: optionalText(300),
  amount: z.number().finite().min(0).max(1e15),
  quantity: z.number().finite().min(0).max(1e9).default(1),
  unit: optionalText(60),
  unitPrice: z.number().finite().min(0).max(1e15).optional(),
  paid: z.boolean().default(false),
  note: optionalText(300),
  actualAmount: z.number().finite().min(0).max(1e15).optional(),
  payerId: optionalText(120),
  isContingency: z.boolean().default(false),
  verificationStatus: z.enum(["unverified", "estimated", "verified"]).default("unverified"),
  paymentProof: optionalText(500),
  locked: z.boolean().default(false),
}).passthrough();

export const documentSchema = z.object({
  id: z.string().min(1),
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(220),
  status: z.string().trim().min(1).max(80).default("Perlu dicek"),
  number: optionalText(120),
  note: optionalText(300),
  locked: z.boolean().default(false),
}).passthrough();

export const travelGuideSchema = z.object({
  transport: optionalText(500),
  accommodation: optionalText(500),
  food: optionalText(500),
  weather: optionalText(500),
  safety: optionalText(500),
  tips: optionalText(500),
}).passthrough();

const metadataText = z.string().trim().min(1).max(400);
export const planSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  planType: planTypeSchema.default("trip"),
  origin: z.string().trim().max(160).default(""),
  destination: z.string().trim().max(240).default(""),
  locations: z.array(locationSchema).max(12).default([]),
  startDate: date,
  endDate: date,
  people: z.coerce.number().int().min(1).max(10_000),
  participants: participantProfileSchema,
  budgetMode: z.enum(["total", "per_person", "open"]).default("total"),
  currency: currencySchema.default("IDR"),
  venue: optionalText(240),
  meetingPoint: optionalText(240),
  timezone: optionalText(80),
  budget: z.coerce.number().finite().min(0).max(1e15),
  activities: z.array(activitySchema).default([]),
  tasks: z.array(taskSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  documents: z.array(documentSchema).default([]),
  travelGuide: travelGuideSchema.default({}),
  facts: z.array(metadataText).max(30).default([]),
  assumptions: z.array(metadataText).max(30).default([]),
  verificationNotes: z.array(metadataText).max(30).default([]),
  conflicts: z.array(metadataText).max(30).default([]),
  alternatives: z.array(metadataText).max(30).default([]),
  risks: z.array(z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(220),
    severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    mitigation: optionalText(500),
    status: z.enum(["open", "mitigated", "accepted"]).default("open"),
    locked: z.boolean().default(false),
  }).passthrough()).default([]),
  notes: optionalText(1200),
  generation: z.object({
    status: z.enum(["local", "draft", "generating", "ready", "error"]).default("local"),
    provider: optionalText(80),
    model: optionalText(120),
    generatedAt: optionalText(40),
    verifiedAt: optionalText(40),
  }).passthrough().default({}),
}).passthrough();
export function migratePlan(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const legacyPeople = Math.max(1, Number(source.people || source.participants?.total || 1) || 1);
  const budget = Math.max(0, Number(String(source.budget ?? 0).replace(/[^0-9.-]/g, "")) || 0);
  const rawParticipants = source.participants && typeof source.participants === "object" ? source.participants : {};
  const adults = Math.max(0, Number(rawParticipants.adults ?? 0) || 0);
  const children = Math.max(0, Number(rawParticipants.children ?? 0) || 0);
  const seniors = Math.max(0, Number(rawParticipants.seniors ?? 0) || 0);
  const breakdownTotal = adults + children + seniors;
  const people = breakdownTotal || legacyPeople;
  const destination = typeof source.destination === "string" ? source.destination.trim() : "";
  const locations = Array.isArray(source.locations) && source.locations.length
    ? source.locations
    : destination ? [{ name: destination, kind: "destination" }] : [];
  const syncStatus = (item, doneStatus, pendingStatus) => {
    const hasStatus = Object.prototype.hasOwnProperty.call(item, "status");
    const done = hasStatus ? item.status === "done" : Boolean(item.done);
    return { ...item, done, status: hasStatus ? item.status : done ? doneStatus : pendingStatus };
  };
  return {
    ...source,
    planType: PLAN_TYPES.includes(source.planType) ? source.planType : "trip",
    people,
    budget,
    currency: CURRENCIES.includes(source.currency) ? source.currency : "IDR",
    budgetMode: ["total", "per_person", "open"].includes(source.budgetMode) ? source.budgetMode : "total",
    participants: {
      total: people,
      adults: breakdownTotal ? adults : people,
      children,
      seniors,
      accessibility: rawParticipants.accessibility || source.specialNeeds || "",
    },
    locations,
    venue: source.venue || "",
    meetingPoint: source.meetingPoint || "",
    timezone: source.timezone || "Asia/Jakarta",
    risks: Array.isArray(source.risks) ? source.risks : [],
    notes: source.notes || "",
    generation: source.generation || { status: source.source === "ai" ? "draft" : "local" },
    activities: Array.isArray(source.activities) ? source.activities.map((item) => syncStatus(item, "done", "planned")) : [],
    tasks: Array.isArray(source.tasks) ? source.tasks.map((item) => syncStatus(item, "done", "todo")) : [],
    expenses: Array.isArray(source.expenses) ? source.expenses : [],
    documents: Array.isArray(source.documents) ? source.documents : [],
  };
}


export function parseBrief(input) {
  const result = briefSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message || "Brief tidak valid.");
  return result.data;
}

export function parsePlan(input) {
  const result = planSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message || "Data plan tidak valid.");
  return result.data;
}
