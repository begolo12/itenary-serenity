import test from "node:test";
import assert from "node:assert/strict";
import { parseStructuredAiContent } from "../src/lib/ai-json.js";

const result = {
  activities: [{ day: "Hari 1", time: "09:00", title: "Tiba", note: "Check-in" }],
  tasks: [{ title: "Pesan tiket" }],
  expenses: [{ category: "Transportasi", amount: 100000 }],
};

test("parses plain JSON", () => {
  assert.deepEqual(parseStructuredAiContent(JSON.stringify(result)), result);
});

test("parses fenced JSON", () => {
  assert.deepEqual(parseStructuredAiContent("```json\n" + JSON.stringify(result) + "\n```") , result);
});

test("extracts JSON after a reasoning block", () => {
  const response = `<think>I will build a concise itinerary.</think>\n${JSON.stringify(result)}`;
  assert.deepEqual(parseStructuredAiContent(response), result);
});

test("repairs common model JSON mistakes", () => {
  const response = "{activities:[{day:'Hari 1',time:'09:00',title:'Tiba',note:'Check-in',}],tasks:[{title:'Tiket'}],expenses:[{category:'Transportasi',amount:100000}]}";
  assert.equal(parseStructuredAiContent(response).activities[0].title, "Tiba");
});

test("rejects malformed JSON", () => {
  assert.throws(() => parseStructuredAiContent("not-json"), /JSON valid/);
});
