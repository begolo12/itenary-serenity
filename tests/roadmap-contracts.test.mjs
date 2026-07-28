import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migratePlan, parsePlan } from "../src/lib/schemas/plan.js";
import { effectiveBudget } from "../src/lib/trips.js";

const basePlan = {
  id: "roadmap-contract",
  title: "Kontrak roadmap",
  startDate: "2026-08-01",
  endDate: "2026-08-01",
  people: 4,
  budget: 1000000,
  budgetMode: "total",
  participants: { total: 4, adults: 4, children: 0, seniors: 0 },
  activities: [],
  tasks: [],
  expenses: [{ id: "expense-1", category: "Transportasi", amount: 200000, actualAmount: 180000, payerId: "pic-1", isContingency: true, paymentProof: "INV-001" }],
  documents: [],
  risks: [],
};

test("expense schema preserves actual, payer, contingency, and payment proof", () => {
  const parsed = parsePlan(basePlan);
  assert.equal(parsed.expenses[0].actualAmount, 180000);
  assert.equal(parsed.expenses[0].payerId, "pic-1");
  assert.equal(parsed.expenses[0].isContingency, true);
  assert.equal(parsed.expenses[0].paymentProof, "INV-001");
});

test("effective budget honors per-person plans after migration", () => {
  const migrated = migratePlan({ ...basePlan, budget: 250000, budgetMode: "per_person", people: 4 });
  assert.equal(effectiveBudget(migrated), 1000000);
});

test("offline queue replaces stale writes for the same trip", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  };
  const { enqueueCloudTrip, offlineQueueSize } = await import("../src/lib/offline-queue.js");
  enqueueCloudTrip("workspace-1", "user-1", { id: "trip-1", title: "Versi lama" });
  enqueueCloudTrip("workspace-1", "user-1", { id: "trip-1", title: "Versi terbaru" });
  assert.equal(offlineQueueSize(), 1);
  assert.match(store.get("serenity-itinerary-offline-queue"), /Versi terbaru/);
});

test("Firestore policy protects collaboration and expiry-bound public shares", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /function canEdit\(workspaceId\)/);
  assert.ok(rules.includes("match /approvals/{approvalId}"));
  assert.ok(rules.includes("match /auditLogs/{logId}"));
  assert.ok(rules.includes("resource.data.expiresAt > request.time"));
  assert.ok(rules.includes("allow create: if canEdit(request.resource.data.workspaceId)"));
});
