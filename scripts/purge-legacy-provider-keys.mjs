import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, dan FIREBASE_ADMIN_PRIVATE_KEY sebelum migrasi.");
}

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const ref = getFirestore(app).doc("_appSettings/provider-keys");
const snapshot = await ref.get();
if (!snapshot.exists) {
  console.log("Dokumen legacy provider-keys tidak ditemukan.");
} else {
  await ref.delete();
  console.log("Dokumen legacy provider-keys dihapus. Kredensial AI sekarang hanya dibaca dari environment server.");
}
