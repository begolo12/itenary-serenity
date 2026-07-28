import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

export function watchAuth(callback) {
  if (!firebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

function requireCloud() {
  if (!firebaseConfigured || !auth || !db) throw new Error("Cloud belum dikonfigurasi.");
}

export async function signInToCloud() {
  requireCloud();
  return signInAnonymously(auth);
}

export async function signInWithGoogle() {
  requireCloud();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result;
}

export async function createCloudAccount(email, password) {
  requireCloud();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithCloudAccount(email, password) {
  requireCloud();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutFromCloud() {
  requireCloud();
  return signOut(auth);
}

export const mergeCloudTrip = (localTrip, cloudTrip) => ({
  ...localTrip,
  ...cloudTrip,
  photo: cloudTrip.photo ?? localTrip.photo ?? null,
});

function cloudErrorCode(error) {
  return error?.code || "";
}

function isTransient(error) {
  return ["unavailable", "deadline-exceeded", "aborted", "internal", "resource-exhausted"].includes(cloudErrorCode(error));
}

async function withRetry(operation, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function bootstrapWorkspace(user) {
  requireCloud();
  const now = new Date().toISOString();
  const userRef = doc(db, "users", user.uid);
  const existingUser = await withRetry(() => getDoc(userRef));
  const existingUserData = existingUser.exists() ? existingUser.data() : {};
  const memberCode = existingUserData.memberCode || await uniqueMemberCode();
  await withRetry(() => setDoc(userRef, {
    uid: user.uid,
    email: user.email || null,
    authType: user.isAnonymous ? "anonymous" : user.email ? "google" : "password",
    memberCode,
    updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "memberCodes", memberCode), {
    uid: user.uid, code: memberCode, memberCode, email: user.email || null, updatedAt: now,
  }, { merge: true }));
  const workspaceRef = doc(db, "workspaces", user.uid);
  await withRetry(() => setDoc(workspaceRef, {
    createdBy: user.uid, updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "workspaces", user.uid, "members", user.uid), {
    uid: user.uid, role: "owner", joinedAt: now,
  }, { merge: true }));
  const existingWorkspace = await withRetry(() => getDoc(workspaceRef));
  const existingData = existingWorkspace.exists() ? existingWorkspace.data() : {};
  const inviteCode = existingData.inviteCode || await uniqueWorkspaceCode();
  const workspaceName = existingData.name || "Workspace Pribadi";
  await withRetry(() => setDoc(workspaceRef, {
    name: workspaceName, inviteCode, createdBy: user.uid, createdAt: existingData.createdAt || now, updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "inviteCodes", inviteCode), {
    workspaceId: user.uid, workspaceName, ownerUid: user.uid, code: inviteCode, updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "users", user.uid, "workspaces", user.uid), {
    workspaceId: user.uid, name: workspaceName, role: "owner", inviteCode, joinedAt: existingData.createdAt || now, updatedAt: now,
  }, { merge: true }));
  return { id: user.uid, name: workspaceName, role: "owner", inviteCode, memberCode };
}

export { withRetry };

function cloudTrip(trip, workspaceId, uid) {
  const { photo, ...safeTrip } = trip;
  return { ...safeTrip, workspaceId, createdBy: uid, hasPhoto: Boolean(photo) };
}

export async function saveCloudTrip(workspaceId, uid, trip) {
  requireCloud();
  await setDoc(doc(db, "workspaces", workspaceId, "trips", trip.id), cloudTrip(trip, workspaceId, uid));
  const photoRef = doc(db, "workspaces", workspaceId, "trips", trip.id, "photos", "cover");
  if (trip.photo) {
    await setDoc(photoRef, {
      ...trip.photo,
      createdAt: trip.photo.createdAt || new Date().toISOString(),
      createdBy: uid,
    });
  } else {
    await deleteDoc(photoRef);
  }
}

export async function deleteCloudTrip(workspaceId, tripId) {
  requireCloud();
  await deleteDoc(doc(db, "workspaces", workspaceId, "trips", tripId, "photos", "cover"));
  await deleteDoc(doc(db, "workspaces", workspaceId, "trips", tripId));
}

export function watchCloudTrips(workspaceId, onTrips, onError) {
  return onSnapshot(collection(db, "workspaces", workspaceId, "trips"), async (snapshot) => {
    try {
      const trips = await Promise.all(snapshot.docs.map(async (item) => {
        const trip = item.data();
        if (!trip.hasPhoto) return { ...trip, photo: null };
        const photo = await getDoc(doc(db, "workspaces", workspaceId, "trips", item.id, "photos", "cover"));
        return { ...trip, photo: photo.exists() ? photo.data() : null };
      }));
      onTrips(trips);
    } catch (error) {
      onError(error);
    }
  }, onError);
}

const WORKSPACE_CODE_LENGTH = 8;
const MEMBER_CODE_LENGTH = 8;

function createWorkspaceCode() {
  return createNumericCode(WORKSPACE_CODE_LENGTH);
}

async function uniqueWorkspaceCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createWorkspaceCode();
    const existing = await withRetry(() => getDoc(doc(db, "inviteCodes", code)));
    if (!existing.exists()) return code;
  }
  throw new Error("Kode workspace gagal dibuat. Coba lagi.");
}

function createMemberCode() {
  return createNumericCode(MEMBER_CODE_LENGTH);
}

function createNumericCode(length) {
  return String(Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)));
}

async function uniqueMemberCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createMemberCode();
    const existing = await withRetry(() => getDoc(doc(db, "memberCodes", code)));
    if (!existing.exists()) return code;
  }
  throw new Error("Kode user gagal dibuat. Coba lagi.");
}

export async function createWorkspace(uid, name) {
  requireCloud();
  const workspaceId = globalThis.crypto?.randomUUID?.() || `${uid}-${Date.now()}`;
  const workspaceName = name.trim();
  if (!workspaceName) throw new Error("Nama workspace wajib diisi.");
  const inviteCode = await uniqueWorkspaceCode();
  const now = new Date().toISOString();
  await withRetry(() => setDoc(doc(db, "workspaces", workspaceId), {
    name: workspaceName, inviteCode, createdBy: uid, createdAt: now, updatedAt: now,
  }));
  await withRetry(() => setDoc(doc(db, "workspaces", workspaceId, "members", uid), {
    uid, role: "owner", joinedAt: now,
  }));
  await withRetry(() => setDoc(doc(db, "inviteCodes", inviteCode), {
    workspaceId, workspaceName, ownerUid: uid, code: inviteCode, updatedAt: now,
  }));
  await withRetry(() => setDoc(doc(db, "users", uid, "workspaces", workspaceId), {
    workspaceId, name: workspaceName, role: "owner", inviteCode, joinedAt: now, updatedAt: now,
  }));
  return { id: workspaceId, name: workspaceName, role: "owner", inviteCode };
}

export async function joinWorkspaceByCode(uid, rawCode) {
  requireCloud();
  const inviteCode = String(rawCode || "").replace(/\D/g, "").slice(0, WORKSPACE_CODE_LENGTH);
  if (inviteCode.length !== WORKSPACE_CODE_LENGTH) throw new Error("Kode workspace harus 8 angka.");
  const inviteSnapshot = await withRetry(() => getDoc(doc(db, "inviteCodes", inviteCode)));
  if (!inviteSnapshot.exists()) {
    const error = new Error("Kode workspace tidak ditemukan atau sudah tidak aktif.");
    error.code = "workspace/not-found";
    throw error;
  }
  const invite = inviteSnapshot.data();
  const workspaceId = invite.workspaceId;
  const userWorkspaceRef = doc(db, "users", uid, "workspaces", workspaceId);
  const alreadyJoined = await withRetry(() => getDoc(userWorkspaceRef));
  if (alreadyJoined.exists()) return { id: workspaceId, ...alreadyJoined.data() };
  const now = new Date().toISOString();
  await withRetry(() => setDoc(doc(db, "workspaces", workspaceId, "members", uid), {
    uid, role: "editor", joinedAt: now, inviteCode,
  }));
  await withRetry(() => setDoc(userWorkspaceRef, {
    workspaceId, name: invite.workspaceName || "Workspace", role: "editor", inviteCode, joinedAt: now, updatedAt: now,
  }));
  return { id: workspaceId, name: invite.workspaceName || "Workspace", role: "editor", inviteCode };
}

export async function inviteUserToWorkspace(ownerUid, workspaceId, rawMemberCode) {
  requireCloud();
  const memberCode = String(rawMemberCode || "").replace(/\D/g, "").slice(0, MEMBER_CODE_LENGTH);
  if (memberCode.length !== MEMBER_CODE_LENGTH) throw new Error("Kode user harus 8 angka.");
  const memberCodeSnapshot = await withRetry(() => getDoc(doc(db, "memberCodes", memberCode)));
  if (!memberCodeSnapshot.exists()) {
    const error = new Error("Kode user tidak ditemukan.");
    error.code = "member/not-found";
    throw error;
  }
  const invitedUser = memberCodeSnapshot.data();
  if (!invitedUser.uid || invitedUser.uid === ownerUid) throw new Error("Kode user tidak dapat digunakan untuk akun ini.");
  const workspaceSnapshot = await withRetry(() => getDoc(doc(db, "workspaces", workspaceId)));
  if (!workspaceSnapshot.exists()) throw new Error("Workspace tidak ditemukan.");
  const memberRef = doc(db, "workspaces", workspaceId, "members", invitedUser.uid);
  const existingMember = await withRetry(() => getDoc(memberRef));
  if (existingMember.exists()) return { uid: invitedUser.uid, memberCode, alreadyMember: true };
  const now = new Date().toISOString();
  await withRetry(() => setDoc(memberRef, {
    uid: invitedUser.uid, role: "editor", joinedAt: now, invitedBy: ownerUid, memberCode,
  }));
  await withRetry(() => setDoc(doc(db, "users", invitedUser.uid, "workspaces", workspaceId), {
    workspaceId, name: workspaceSnapshot.data().name || "Workspace", role: "editor", memberCode, joinedAt: now, updatedAt: now,
  }));
  return { uid: invitedUser.uid, memberCode, alreadyMember: false };
}

export function watchCloudWorkspaces(uid, onWorkspaces, onError) {
  return onSnapshot(collection(db, "users", uid, "workspaces"), (snapshot) => {
    onWorkspaces(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function saveSharedApiKey(provider, apiKey) {
  requireCloud();
  const ref = doc(db, "_appSettings", "provider-keys");
  await withRetry(() => setDoc(ref, { [`provider:${provider}`]: apiKey, updatedAt: new Date().toISOString() }, { merge: true }));
}

export async function loadSharedApiKey(provider) {
  requireCloud();
  const ref = doc(db, "_appSettings", "provider-keys");
  const snapshot = await withRetry(() => getDoc(ref));
  if (!snapshot.exists()) return "";
  return snapshot.data()[`provider:${provider}`] || "";
}

export async function sharedApiKeyExists() {
  requireCloud();
  const ref = doc(db, "_appSettings", "provider-keys");
  const snapshot = await withRetry(() => getDoc(ref));
  return snapshot.exists();
}

export const SUPER_ADMIN_EMAIL = "begolo111@gmail.com";

export function isSuperAdmin(user) {
  return user?.email === SUPER_ADMIN_EMAIL;
}
