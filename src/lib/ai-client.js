import { auth } from "./firebase";

async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sesi login belum siap. Coba lagi setelah halaman selesai dimuat.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Permintaan AI gagal.");
  return result;
}

export async function getAiProviderStatus() {
  const response = await fetch("/api/ai/config", { headers: await authHeaders(), cache: "no-store" });
  return readResponse(response);
}

export async function generateWithAi(body) {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return readResponse(response);
}
