import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const PROVIDER_ENV = {
  deepseek: "SERENITY_DEEPSEEK_API_KEY",
  openai: "SERENITY_OPENAI_API_KEY",
  gemini: "SERENITY_GEMINI_API_KEY",
};

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : undefined;
const adminApp = getApps()[0] || initializeApp(credential ? { credential, projectId } : projectId ? { projectId } : undefined);

export function supportedProvider(provider) {
  return Object.hasOwn(PROVIDER_ENV, provider);
}

export function providerKey(provider) {
  if (!supportedProvider(provider)) throw new Error("Provider AI tidak didukung.");
  return process.env[PROVIDER_ENV[provider]]?.trim() || "";
}

export function providerStatus() {
  return Object.fromEntries(Object.keys(PROVIDER_ENV).map((provider) => [provider, Boolean(providerKey(provider))]));
}

export async function requireAiUser(request, workspaceId = "") {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    const error = new Error("Sesi login diperlukan untuk menggunakan AI.");
    error.status = 401;
    throw error;
  }
  let decoded;
  try {
    decoded = await getAuth(adminApp).verifyIdToken(token);
  } catch {
    const error = new Error("Sesi login tidak valid. Muat ulang halaman dan coba lagi.");
    error.status = 401;
    throw error;
  }
  if (decoded.firebase?.sign_in_provider === "anonymous") {
    const error = new Error("Akun tamu tidak dapat menggunakan AI berbayar. Masuk dengan email atau Google terlebih dahulu.");
    error.status = 403;
    throw error;
  }
  if (workspaceId) {
    const member = await getFirestore(adminApp).doc(`workspaces/${workspaceId}/members/${decoded.uid}`).get();
    if (!member.exists || !["owner", "editor"].includes(member.data()?.role)) {
      const error = new Error("Anda tidak memiliki izin membuat generasi AI di workspace ini.");
      error.status = 403;
      throw error;
    }
  }
  return decoded;
}

export async function consumeAiRateLimit(uid, workspaceId) {
  const ref = getFirestore(adminApp).doc(`workspaces/${workspaceId}/aiRateLimits/${uid}`);
  const now = Date.now();
  let allowed = true;
  await getFirestore(adminApp).runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const windowStartedAt = Number(data.windowStartedAt) || now;
    const count = now - windowStartedAt >= 60_000 ? 0 : Number(data.count) || 0;
    allowed = count < 12;
    transaction.set(ref, { windowStartedAt: count === 0 ? now : windowStartedAt, count: allowed ? count + 1 : count, updatedAt: now }, { merge: true });
  });
  return allowed;
}
export function missingProviderMessage(provider) {
  const envName = PROVIDER_ENV[provider];
  return `Provider ${provider} belum dikonfigurasi di server. Tambahkan ${envName} pada environment deployment.`;
}
