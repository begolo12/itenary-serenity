import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { deleteProviderKey, loadProviderKey, saveProviderKey } from "../src/lib/secure-key-store.js";

test("persists and decrypts a provider key", async () => {
  await saveProviderKey("deepseek-test", "sk-secret-verification");
  assert.equal(await loadProviderKey("deepseek-test"), "sk-secret-verification");
  await deleteProviderKey("deepseek-test");
  assert.equal(await loadProviderKey("deepseek-test"), "");
});
