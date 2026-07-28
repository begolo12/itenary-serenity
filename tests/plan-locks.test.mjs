import test from "node:test";
import assert from "node:assert/strict";
import { migratePlan, parsePlan } from "../src/lib/schemas/plan.js";

const basePlan = {
  id: "plan-lock-test",
  title: "Plan lock test",
  startDate: "2026-08-01",
  endDate: "2026-08-01",
  people: 2,
  budget: 1000000,
  activities: [{ id: "activity-1", day: "Hari 1", time: "09:00", title: "Agenda terkunci", locked: true }],
  tasks: [{ id: "task-1", title: "Tugas terkunci", locked: true }],
  expenses: [{ id: "expense-1", category: "Transportasi", amount: 100000, locked: true }],
  documents: [{ id: "document-1", type: "Reservasi", title: "Booking terkunci", locked: true }],
  risks: [{ id: "risk-1", title: "Risiko terkunci", locked: true }],
};

test("plan schema accepts locked items in every regenerable collection", () => {
  const parsed = parsePlan(basePlan);
  assert.equal(parsed.activities[0].locked, true);
  assert.equal(parsed.tasks[0].locked, true);
  assert.equal(parsed.expenses[0].locked, true);
  assert.equal(parsed.documents[0].locked, true);
  assert.equal(parsed.risks[0].locked, true);
});

test("legacy migration preserves lock flags while normalizing status", () => {
  const migrated = migratePlan({ ...basePlan, activities: [{ ...basePlan.activities[0], status: "done" }] });
  assert.equal(migrated.activities[0].locked, true);
  assert.equal(migrated.activities[0].done, true);
  assert.equal(migrated.activities[0].status, "done");
});
