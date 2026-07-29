import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  }
  let credential;
  if (clientEmail && privateKey) {
    try {
      credential = cert({ projectId, clientEmail, privateKey });
    } catch (err) {
      console.error("Firebase admin credential error:", err);
    }
  }
  return initializeApp(credential ? { credential, projectId } : projectId ? { projectId } : undefined);
}

const SUPER_ADMIN_EMAIL = "superadmin@local.com";

export async function GET(request) {
  try {
    const adminApp = getAdminApp();
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await getAuth(adminApp).verifyIdToken(token);
    } catch (err) {
      console.error("Admin pending token error:", err);
      return Response.json({ error: "Token tidak valid" }, { status: 401 });
    }
    if (decoded.email !== SUPER_ADMIN_EMAIL) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const snapshot = await getFirestore(adminApp)
      .collection("users")
      .where("status", "==", "pending")
      .get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { uid: doc.id, email: data.email };
    });
    return Response.json({ users });
  } catch (error) {
    console.error("Admin pending error:", error);
    return Response.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
