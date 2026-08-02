import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestTitle, createTemplate, cloneTrip } from "../src/lib/trips.js";

test("suggestTitle falls back when purpose is empty", () => {
  const title = suggestTitle({ planType: "trip", purpose: "", destination: "Bali" });
  assert.equal(title, "Bali");
});

test("suggestTitle combines purpose and destination", () => {
  const title = suggestTitle({ planType: "trip", purpose: "Leisure", destination: "Yogyakarta" });
  assert.equal(title, "Leisure di Yogyakarta");
});

test("suggestTitle handles venue for non-trip plans", () => {
  const title = suggestTitle({ planType: "gathering", purpose: "", venue: "Gedung Serbaguna" });
  assert.equal(title, "Gathering / outing: Rencana · Gedung Serbaguna");
});

test("suggestTitle fully empty falls back to Perjalanan baru", () => {
  const title = suggestTitle({ planType: "trip", purpose: "", destination: "", venue: "" });
  assert.equal(title, "Perjalanan baru");
});

test("createTemplate uses suggestTitle for trip plans", () => {
  const trip = createTemplate({
    planType: "trip", purpose: "", origin: "Jakarta", destination: "Bali",
    startDate: "2026-09-01", endDate: "2026-09-03", people: "2",
    participants: { total: 2, adults: 2, children: 0, seniors: 0 },
    tripMode: "overnight", roomMode: "single", budget: "1000000", budgetMode: "total", currency: "IDR",
  });
  assert.equal(trip.title, "Bali");
  assert.ok(trip.id);
});

test("cloneTrip creates new id and title suffix", () => {
  const base = createTemplate({
    planType: "trip", purpose: "Leisure", origin: "Jakarta", destination: "Bali",
    startDate: "2026-09-01", endDate: "2026-09-03", people: "2",
    participants: { total: 2, adults: 2, children: 0, seniors: 0 },
    tripMode: "overnight", roomMode: "single", budget: "1000000", budgetMode: "total", currency: "IDR",
  });
  const clone = cloneTrip(base);
  assert.notEqual(clone.id, base.id);
  assert.equal(clone.title, `${base.title} (salinan)`);
  assert.deepEqual(clone.tasks, base.tasks);
  assert.deepEqual(clone.expenses, base.expenses);
  assert.ok(clone.updatedAt);
});

test("cloneTrip keeps photo reference copied", () => {
  const base = createTemplate({
    planType: "trip", purpose: "Leisure", origin: "Jakarta", destination: "Bali",
    startDate: "2026-09-01", endDate: "2026-09-03", people: "2",
    participants: { total: 2, adults: 2, children: 0, seniors: 0 },
    tripMode: "overnight", roomMode: "single", budget: "1000000", budgetMode: "total", currency: "IDR",
  });
  base.photo = { photoData: "data:image/webp;base64,xx", mimeType: "image/webp" };
  const clone = cloneTrip(base);
  assert.equal(clone.photo.photoData, base.photo.photoData);
  assert.notEqual(clone.id, base.id);
});
