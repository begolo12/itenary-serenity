import { auth } from "./firebase";

async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sesi login belum siap. Coba lagi setelah halaman selesai dimuat.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    let errMessage = result.error || "Permintaan AI gagal.";
    if (typeof errMessage === "string" && (errMessage.includes("UNAUTHENTICATED") || errMessage.includes("OAuth 2") || errMessage.includes("authentication credentials"))) {
      errMessage = "Kunci/Token Firebase Admin di server tidak valid atau belum sesuai. Silakan hubungi admin server.";
    }
    throw new Error(errMessage);
  }
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
