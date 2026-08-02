import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { approveUser } from "./admin-helper.mjs";

// ONE full user journey in a single page (auth session must persist across steps):
// register -> pending screen -> admin approves (Firestore REST) -> auto-reload after approval ->
// login -> dashboard renders -> create itinerary (local template wizard) -> detail tabs ->
// edit trip via modal -> add checklist item -> delete trip -> logout -> back at login.
// Test data only: fresh random email per run; production docs untouched.

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}
const API_KEY = loadEnv().NEXT_PUBLIC_FIREBASE_API_KEY;

const SUFFIX = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const EMAIL = `e2e-${SUFFIX}@test.local`;
const PASSWORD = "rahasia123";

test("full journey: register, approve, login, CRUD itinerary, logout", async ({ page }) => {
  // ---- Register ----
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Serenity" })).toBeVisible();
  // Password reset UI
  await page.getByRole("button", { name: "Lupa password?" }).click();
  await expect(page.getByRole("button", { name: "Kirim tautan reset" })).toBeVisible();
  await page.getByRole("button", { name: "← Kembali ke masuk" }).click();
  await expect(page.getByRole("button", { name: "Masuk & sinkronkan" })).toBeVisible();
  await page.getByRole("button", { name: "Buat Akun Baru" }).click();
  await page.getByPlaceholder("nama@email.com").fill(EMAIL);
  await page.getByPlaceholder("Minimal 6 karakter").fill(PASSWORD);
  await page.getByRole("button", { name: "Buat akun & sinkronkan" }).click();
  await expect(page.getByText("Akun menunggu persetujuan")).toBeVisible({ timeout: 15000 });

  // ---- Admin approves (server-side data only) ----
  const res = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  expect(res.status).toBe(200);
  const auth = await res.json();
  expect(auth.localId).toBeTruthy();
  await approveUser(auth.localId, EMAIL);

  // Pending screen watches users/{uid}; once approved the app reloads itself.
  await expect(page.getByText("Rencanakan dengan tenang.")).toBeVisible({ timeout: 30000 });

  // ---- Onboarding tour shows for first-time user; skip it ----
  const onboarding = page.getByRole("dialog", { name: "Panduan singkat Serenity" });
  await expect(onboarding).toBeVisible({ timeout: 25000 });
  await expect(onboarding.getByText("Buat itinerary").first()).toBeVisible();
  await onboarding.getByRole("button", { name: "Lanjut" }).click();
  await onboarding.getByRole("button", { name: "Lanjut" }).click();
  await onboarding.getByRole("button", { name: "Selesai" }).click();
  await expect(onboarding).toBeHidden({ timeout: 5000 });

  // ---- Dashboard renders ----
  await expect(page.getByText("Atlas Anda masih kosong")).toBeVisible();

  // ---- Create itinerary via local template wizard ----
  await page.getByRole("button", { name: "Buat itinerary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Perjalanan baru" })).toBeVisible();
  await page.getByPlaceholder("Cari kota asal...").fill("Jakarta");
  await page.getByPlaceholder("Contoh: Bali, Bandung, kantor klien").fill("Yogyakarta");
  await page.getByRole("button", { name: "Lanjut" }).click();
  const start = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Tanggal mulai").fill(start);
  await page.getByLabel("Tanggal selesai").fill(end);
  await page.getByPlaceholder("Mis. Leisure, bisnis, keluarga...").fill("Leisure");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  // Title preview visible on confirmation step
  await expect(page.locator(".title-preview")).toContainText("Leisure di Yogyakarta");
  await page.getByRole("button", { name: "Gunakan template lokal" }).click();
  await expect(page.locator("h2").filter({ hasText: "Leisure di Yogyakarta" }).first()).toBeVisible({ timeout: 15000 });

  // ---- Detail tabs ----
  await expect(page.getByRole("tab", { name: "Ringkasan" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Rundown" }).click();
  await expect(page.getByRole("tab", { name: "Rundown" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Anggaran" }).click();
  await page.getByRole("tab", { name: "Checklist" }).click();
  await page.getByRole("tab", { name: "Dokumen" }).click();
  await page.getByRole("tab", { name: "Kolaborasi" }).click();
  await page.getByRole("tab", { name: "Ringkasan" }).click();

  // ---- Edit trip detail ----
  await page.getByRole("button", { name: "Edit detail" }).click();
  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  const titleInput = modal.getByLabel("Judul");
  await titleInput.fill(`Leisure di Yogyakarta (edit)`);
  await modal.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.locator("h2").filter({ hasText: `Leisure di Yogyakarta (edit)` }).first()).toBeVisible({ timeout: 10000 });

  // ---- Add checklist item ----
  await page.getByRole("tab", { name: "Checklist" }).click();
  await page.getByRole("button", { name: /Tambah/ }).click();
  await page.locator(".modal-backdrop").getByLabel("Nama tugas").fill("Beli tiket kereta");
  await page.locator(".modal-backdrop").getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Beli tiket kereta").first()).toBeVisible({ timeout: 10000 });

  // ---- Trip card budget indicator (back to home) ----
  await page.getByRole("button", { name: "Beranda" }).click();
  await expect(page.getByRole("heading", { name: "Rencanakan dengan tenang." })).toBeVisible();
  const tripCard = page.locator(".trip-card").first();
  await expect(tripCard.locator(".trip-budget")).toBeVisible({ timeout: 10000 });
  await expect(tripCard.locator(".trip-progress")).toBeVisible();
  await tripCard.click();
  await expect(page.locator("h2").filter({ hasText: "Leisure di Yogyakarta (edit)" }).first()).toBeVisible({ timeout: 10000 });

  // ---- Dashboard sort select exists ----
  await page.getByRole("button", { name: "Beranda" }).click();
  await expect(page.getByLabel("Urutkan perjalanan")).toBeVisible();
  await page.getByLabel("Urutkan perjalanan").selectOption("title");
  await expect(page.getByLabel("Urutkan perjalanan")).toHaveValue("title");
  await page.locator(".sidebar").getByRole("button", { name: /Itinerary/ }).click();

  // ---- Duplicate itinerary ----
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Duplikat" }).click();
  await expect(page.locator("h2").filter({ hasText: "Leisure di Yogyakarta (edit) (salinan)" }).first()).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Hapus" }).first().click({ force: true });
  // Deleting returns to home; reopen the original trip
  await expect(page.getByRole("heading", { name: "Rencanakan dengan tenang." })).toBeVisible({ timeout: 10000 });
  await page.locator(".trip-card").first().click();
  await expect(page.locator("h2").filter({ hasText: "Leisure di Yogyakarta (edit)" }).first()).toBeVisible({ timeout: 10000 });

  // ---- Delete itinerary ----
  await page.getByRole("button", { name: "Hapus" }).first().click({ force: true });
  await expect(page.getByRole("heading", { name: "Rencanakan dengan tenang." })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Atlas Anda masih kosong")).toBeVisible();

  // ---- Calendar: month nav + day dots ----
  await page.getByRole("button", { name: "Kalender" }).click();
  await expect(page.getByRole("heading", { name: "Kalender perjalanan" })).toBeVisible();
  const monthHeading = page.locator(".calendar-month-nav h2");
  const before = await monthHeading.innerText();
  await page.getByRole("button", { name: "Bulan berikutnya" }).click();
  await expect(monthHeading).not.toHaveText(before);
  await page.getByRole("button", { name: "Bulan sebelumnya" }).click();
  await expect(monthHeading).toHaveText(before);

  // ---- Logout (via sidebar nav, SPA view switch) ----
  await page.getByRole("button", { name: "Pengaturan" }).click();
  await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
  await page.getByRole("button", { name: "Keluar dari cloud" }).click();
  await expect(page.getByRole("button", { name: "Lanjutkan dengan Google" })).toBeVisible({ timeout: 15000 });
});
