import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

function createNumericCode(length) {
  return String(Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)));
}

async function uniqueInviteCode(firestore) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createNumericCode(8);
    const existing = await firestore.doc(`inviteCodes/${code}`).get();
    if (!existing.exists()) return code;
  }
  throw new Error("Kode invite gagal dibuat.");
}

async function uniqueMemberCode(firestore) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createNumericCode(8);
    const existing = await firestore.doc(`memberCodes/${code}`).get();
    if (!existing.exists()) return code;
  }
  throw new Error("Kode user gagal dibuat.");
}

export async function POST(request) {
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
      console.error("Admin approve token error:", err);
      return Response.json({ error: "Token tidak valid" }, { status: 401 });
    }
    if (decoded.email !== SUPER_ADMIN_EMAIL) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const { uid, action } = body || {};
    if (!uid || !["approve", "reject"].includes(action)) {
      return Response.json({ error: "Body harus memiliki uid dan action ('approve' | 'reject')" }, { status: 400 });
    }
    const firestore = getFirestore(adminApp);
    const now = new Date().toISOString();

    if (action === "reject") {
      await firestore.doc(`users/${uid}`).update({
        status: "rejected",
        rejectedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ ok: true });
    }

    // approve
    await firestore.doc(`users/${uid}`).update({
      status: "approved",
      updatedAt: now,
    });
    const memberCode = await uniqueMemberCode(firestore);
    // Ensure memberCode on user doc
    await firestore.doc(`memberCodes/${memberCode}`).set({
      uid, code: memberCode, memberCode, updatedAt: now,
    }, { merge: true });
    // Create workspace
    const workspaceId = uid;
    const inviteCode = await uniqueInviteCode(firestore);
    const workspaceName = "Workspace Pribadi";
    await firestore.doc(`workspaces/${workspaceId}`).set({
      name: workspaceName, inviteCode, createdBy: uid, createdAt: now, updatedAt: now,
    }, { merge: true });
    await firestore.doc(`workspaces/${workspaceId}/members/${uid}`).set({
      uid, role: "owner", joinedAt: now,
    }, { merge: true });
    await firestore.doc(`inviteCodes/${inviteCode}`).set({
      workspaceId, workspaceName, ownerUid: uid, code: inviteCode, updatedAt: now,
    }, { merge: true });
    await firestore.doc(`users/${uid}/workspaces/${workspaceId}`).set({
      workspaceId, name: workspaceName, role: "owner", inviteCode, joinedAt: now, updatedAt: now,
    }, { merge: true });
    return Response.json({ ok: true, workspaceId });
  } catch (error) {
    console.error("Admin approve error:", error);
    return Response.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
