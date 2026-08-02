// E2E helper: approve a pending user + create their personal workspace via Firestore REST
// (mirrors src/app/api/admin/approve/route.js). Adds NEW data only; never touches existing docs.
import fs from "node:fs";
import crypto from "node:crypto";

const PROJECT_ID = "ittenery";

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

async function mintToken() {
  const env = loadEnv();
  const email = env.FIREBASE_ADMIN_CLIENT_EMAIL.replace(/^["']|["']$/g, "").trim();
  const pk = env.FIREBASE_ADMIN_PRIVATE_KEY.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signing = b64(header) + "." + b64(claims);
  const sig = crypto.createSign("RSA-SHA256").update(signing).sign(pk, "base64url");
  const assertion = signing + "." + sig;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token mint failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

const randomDigits = (n) => String(Math.floor(Math.random() * 9 * 10 ** (n - 1)) + 10 ** (n - 1));

function mapFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string") out[k] = { stringValue: v };
    else if (typeof v === "boolean") out[k] = { booleanValue: v };
    else if (typeof v === "number") out[k] = { integerValue: String(v) };
    else throw new Error(`unsupported field type for ${k}: ${typeof v}`);
  }
  return out;
}

// Merge-patch existing doc (only listed fields change; unknown fields preserved).
async function patchDoc(token, path, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${mask}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields: mapFields(fields) }) }
  );
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Create a brand-new doc under parent with explicit docId.
async function createDoc(token, parentPath, docId, fields) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${parentPath}?documentId=${docId}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields: mapFields(fields) }) }
  );
  if (!res.ok) throw new Error(`CREATE ${parentPath}/${docId} -> ${res.status} ${await res.text()}`);
  return res.json();
}

export async function approveUser(uid, email) {
  const token = await mintToken();
  const now = new Date().toISOString();
  const memberCode = randomDigits(8);
  const inviteCode = randomDigits(8);
  const workspaceName = "Workspace Pribadi";

  await patchDoc(token, `users/${uid}`, { status: "approved", updatedAt: now, memberCode });
  await patchDoc(token, `memberCodes/${memberCode}`, {
    uid, code: memberCode, memberCode, updatedAt: now,
  });
  await patchDoc(token, `workspaces/${uid}`, {
    name: workspaceName, inviteCode, createdBy: uid, createdAt: now, updatedAt: now,
  });
  await patchDoc(token, `workspaces/${uid}/members/${uid}`, { uid, role: "owner", joinedAt: now });
  await patchDoc(token, `inviteCodes/${inviteCode}`, {
    workspaceId: uid, workspaceName, ownerUid: uid, code: inviteCode, updatedAt: now,
  });
  await patchDoc(token, `users/${uid}/workspaces/${uid}`, {
    workspaceId: uid, name: workspaceName, role: "owner", inviteCode, joinedAt: now, updatedAt: now,
  });
  return { memberCode, inviteCode };
}
