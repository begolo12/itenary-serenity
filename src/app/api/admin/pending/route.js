import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : undefined;
const adminApp = getApps()[0] || initializeApp(credential ? { credential, projectId } : projectId ? { projectId } : undefined);

const SUPER_ADMIN_EMAIL = "superadmin@local.com";

export async function GET(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let decoded;
  try {
    decoded = await getAuth(adminApp).verifyIdToken(token);
  } catch {
    return Response.json({ error: "Token tidak valid" }, { status: 401 });
  }
  if (decoded.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const snapshot = await getFirestore(adminApp)
    .collection("users")
    .where("status", "==", "pending")
    .orderBy("updatedAt")
    .get();
  const users = snapshot.docs.map((doc) => {
    const data = doc.data();
    return { uid: doc.id, email: data.email, registeredAt: data.updatedAt };
  });
  return Response.json({ users });
}
