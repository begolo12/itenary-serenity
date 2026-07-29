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
import { enqueueCloudTrip, offlineQueueSize, readOfflineQueue, writeOfflineQueue } from "./offline-queue.js";

export const SUPER_ADMIN_EMAIL = "superadmin@local.com";

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

export const mergeCloudTrip = (localTrip = {}, cloudTrip = {}) => ({
  ...localTrip,
  ...cloudTrip,
  photo: cloudTrip.hasPhoto === false ? null : cloudTrip.photo ?? localTrip.photo ?? null,
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

  // ALWAYS ensure user doc has memberCode and memberCodes collection maps this code to user
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

  if (user.email === SUPER_ADMIN_EMAIL) {
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

  if (existingUserData.status === "approved") {
    const wsRef = doc(db, "workspaces", user.uid);
    const memberRef = doc(db, "workspaces", user.uid, "members", user.uid);
    const userWsRef = doc(db, "users", user.uid, "workspaces", user.uid);
    // Ensure workspace and member documents exist client-side so security rules succeed
    await withRetry(() => setDoc(wsRef, {
      name: "Workspace Pribadi", createdBy: user.uid, updatedAt: now,
    }, { merge: true }));
    await withRetry(() => setDoc(memberRef, {
      uid: user.uid, role: "owner", joinedAt: now,
    }, { merge: true }));
    const wsSnap = await withRetry(() => getDoc(wsRef));
    const wsData = wsSnap.exists() ? wsSnap.data() : {};
    const inviteCode = wsData.inviteCode || await uniqueWorkspaceCode();
    if (!wsData.inviteCode) {
      await withRetry(() => setDoc(wsRef, { inviteCode }, { merge: true }));
      await withRetry(() => setDoc(doc(db, "inviteCodes", inviteCode), {
        workspaceId: user.uid, workspaceName: wsData.name || "Workspace Pribadi", ownerUid: user.uid, code: inviteCode, updatedAt: now,
      }, { merge: true }));
    }
    await withRetry(() => setDoc(userWsRef, {
      workspaceId: user.uid, name: wsData.name || "Workspace Pribadi", role: "owner", inviteCode, joinedAt: now, updatedAt: now,
    }, { merge: true }));
    return { id: user.uid, name: wsData.name || "Workspace Pribadi", role: "owner", inviteCode, memberCode };
  }

  await withRetry(() => setDoc(userRef, {
    status: "pending",
  }, { merge: true }));

  return { pending: true, user: { uid: user.uid, email: user.email } };
}


export { withRetry };
export { enqueueCloudTrip, offlineQueueSize };

export async function flushCloudQueue(workspaceId, uid) {
  const queue = readOfflineQueue();
  const pending = [];
  const conflicts = [];
  for (const item of queue) {
    if (item.workspaceId !== workspaceId || item.uid !== uid) {
      pending.push(item);
      continue;
    }
    try {
      await saveCloudTrip(item.workspaceId, item.uid, item.trip, { queueOnFailure: false });
    } catch (error) {
      if (error?.code === "cloud/conflict") conflicts.push(item.trip?.title || item.trip?.id || "Itinerary");
      else pending.push(item);
    }
  }
  writeOfflineQueue(pending);
  return { flushed: queue.length - pending.length - conflicts.length, conflicts };
}

function cloudConflictError() {
  const error = new Error("Cloud memiliki perubahan yang lebih baru. Periksa versi sebelum menimpa.");
  error.code = "cloud/conflict";
  return error;
}


function cloudTrip(trip, workspaceId, uid) {
  const { photo, ...safeTrip } = trip;
  return { ...safeTrip, workspaceId, createdBy: uid, hasPhoto: Boolean(photo) };
}

export async function saveCloudTrip(workspaceId, uid, trip, { queueOnFailure = true } = {}) {
  requireCloud();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueueCloudTrip(workspaceId, uid, trip);
    return { queued: true };
  }
  const tripRef = doc(db, "workspaces", workspaceId, "trips", trip.id);
  const photoRef = doc(db, "workspaces", workspaceId, "trips", trip.id, "photos", "cover");
  try {
    const current = await getDoc(tripRef);
    const currentUpdated = Date.parse(current.data()?.updatedAt || "");
    const localUpdated = Date.parse(trip.updatedAt || "");
    if (current.exists() && currentUpdated && localUpdated && currentUpdated > localUpdated) throw cloudConflictError();
    if (trip.photo) {
      await setDoc(photoRef, {
        ...trip.photo,
        createdAt: trip.photo.createdAt || new Date().toISOString(),
        createdBy: uid,
      });
    } else {
      await deleteDoc(photoRef);
    }
    await setDoc(tripRef, cloudTrip(trip, workspaceId, uid));
    return { queued: false };
  } catch (error) {
    if (queueOnFailure && error?.code !== "cloud/conflict" && (isTransient(error) || (typeof navigator !== "undefined" && navigator.onLine === false))) {
      enqueueCloudTrip(workspaceId, uid, trip);
    }
    throw error;
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

export async function createWorkspace(uid, name, existingWorkspaces = []) {
  requireCloud();
  const workspaceName = name.trim();
  if (!workspaceName) throw new Error("Nama workspace wajib diisi.");

  if (existingWorkspaces.some((w) => (w.name || "").trim().toLowerCase() === workspaceName.toLowerCase())) {
    throw new Error(`Workspace dengan nama "${workspaceName}" sudah ada.`);
  }

  const workspaceId = globalThis.crypto?.randomUUID?.() || `${uid}-${Date.now()}`;
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

export async function deleteWorkspace(uid, workspaceId) {
  requireCloud();
  if (workspaceId === uid) {
    throw new Error("Workspace Pribadi tidak dapat dihapus. Gunakan fitur Reset Workspace untuk menghapusnya.");
  }
  // Delete workspace doc & user's workspace mapping
  await deleteDoc(doc(db, "users", uid, "workspaces", workspaceId));
  await deleteDoc(doc(db, "workspaces", workspaceId, "members", uid));
}

export async function leaveWorkspace(uid, workspaceId) {
  requireCloud();
  // Remove user mapping and member record when leaving workspace
  await deleteDoc(doc(db, "users", uid, "workspaces", workspaceId));
  await deleteDoc(doc(db, "workspaces", workspaceId, "members", uid));
}

export async function resetPersonalWorkspace(uid) {
  requireCloud();
  // Fetch all trips in personal workspace and delete them
  const tripsRef = collection(db, "workspaces", uid, "trips");
  const snapshot = await withRetry(() => getDoc(doc(db, "workspaces", uid))); // verification
  // Delete subcollection trips
  const tripsSnap = await withRetry(() => import("firebase/firestore").then(({ getDocs }) => getDocs(tripsRef)));
  const batchDeletes = tripsSnap.docs.map(async (item) => {
    await deleteCloudTrip(uid, item.id);
  });
  await Promise.all(batchDeletes);
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

export async function inviteUserToWorkspace(ownerUid, workspaceId, rawMemberCode, requestedRole = "editor") {
  requireCloud();
  const role = ["editor", "viewer"].includes(requestedRole) ? requestedRole : "editor";
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
    uid: invitedUser.uid, role, joinedAt: now, invitedBy: ownerUid, memberCode,
  }));
  await withRetry(() => setDoc(doc(db, "users", invitedUser.uid, "workspaces", workspaceId), {
    workspaceId, name: workspaceSnapshot.data().name || "Workspace", role, inviteCode: workspaceSnapshot.data().inviteCode || "", memberCode, joinedAt: now, updatedAt: now,
  }));
  return { uid: invitedUser.uid, memberCode, alreadyMember: false };
}

export function watchCloudWorkspaces(uid, onWorkspaces, onError) {
  return onSnapshot(collection(db, "users", uid, "workspaces"), (snapshot) => {
    onWorkspaces(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}


export function cloudMessage(error) {
  if (error?.code === "permission-denied") return "Cloud menolak akses. Periksa bahwa Anonymous Auth aktif dan aturan workspace mengizinkan anggota.";
  if (error?.code === "unavailable") return "Cloud tidak tersedia. Perubahan tetap aman di perangkat dan akan dicoba lagi.";
  return `Sinkronisasi cloud gagal: ${error?.message || "kesalahan tidak dikenal"}`;
}
function cloudId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

async function writeTripAudit(workspaceId, tripId, uid, action, metadata = {}) {
  const createdAt = new Date().toISOString();
  await setDoc(doc(db, "workspaces", workspaceId, "trips", tripId, "auditLogs", cloudId("log")), {
    action, actorUid: uid, createdAt, ...metadata,
  });
}

export function watchTripCollaboration(workspaceId, tripId, callbacks = {}) {
  requireCloud();
  const root = (collectionName) => collection(db, "workspaces", workspaceId, "trips", tripId, collectionName);
  const subscriptions = [
    ["comments", "comments"],
    ["approvals", "approvals"],
    ["versions", "versions"],
    ["auditLogs", "auditLogs"],
  ].map(([collectionName, callbackName]) => onSnapshot(root(collectionName), (snapshot) => {
    const entries = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    entries.sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));
    callbacks[callbackName]?.(entries);
  }, callbacks.onError));
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

export async function addTripComment(workspaceId, tripId, uid, text) {
  requireCloud();
  const comment = String(text || "").trim();
  if (!comment) throw new Error("Komentar tidak boleh kosong.");
  if (comment.length > 1000) throw new Error("Komentar maksimal 1.000 karakter.");
  const createdAt = new Date().toISOString();
  await setDoc(doc(db, "workspaces", workspaceId, "trips", tripId, "comments", cloudId("comment")), {
    text: comment, actorUid: uid, createdAt, resolved: false,
  });
  await writeTripAudit(workspaceId, tripId, uid, "comment.created");
}

export async function setTripApproval(workspaceId, tripId, uid, status, note = "") {
  requireCloud();
  const allowed = ["pending", "approved", "changes_requested"];
  if (!allowed.includes(status)) throw new Error("Status approval tidak valid.");
  const updatedAt = new Date().toISOString();
  await setDoc(doc(db, "workspaces", workspaceId, "trips", tripId, "approvals", uid), {
    uid, status, note: String(note || "").slice(0, 500), updatedAt,
  });
  await writeTripAudit(workspaceId, tripId, uid, "approval.updated", { status });
}

export async function createTripVersion(workspaceId, trip, uid, note = "") {
  requireCloud();
  const createdAt = new Date().toISOString();
  const snapshot = cloudTrip(trip, workspaceId, uid);
  delete snapshot.workspaceId;
  delete snapshot.createdBy;
  await setDoc(doc(db, "workspaces", workspaceId, "trips", trip.id, "versions", cloudId("version")), {
    createdAt, actorUid: uid, note: String(note || "").slice(0, 300), snapshot,
  });
  await writeTripAudit(workspaceId, trip.id, uid, "version.created", { note: String(note || "").slice(0, 300) });
}

export async function createPublicTripShare(workspaceId, trip, uid, days = 7) {
  requireCloud();
  const duration = Math.min(30, Math.max(1, Number(days) || 7));
  const shareId = cloudId("share").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 50);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  const snapshot = cloudTrip(trip, workspaceId, uid);
  delete snapshot.workspaceId;
  delete snapshot.createdBy;
  delete snapshot.photo;
  await setDoc(doc(db, "publicShares", shareId), {
    shareId, workspaceId, tripId: trip.id, title: trip.title || "Itinerary", snapshot,
    createdBy: uid, createdAt, expiresAt,
  });
  await writeTripAudit(workspaceId, trip.id, uid, "share.created", { shareId, expiresAt: expiresAt.toISOString() });
  return { shareId, expiresAt: expiresAt.toISOString() };
}

export async function getPublicTripShare(shareId) {
  if (!firebaseConfigured || !db) throw new Error("Cloud belum dikonfigurasi.");
  const snapshot = await getDoc(doc(db, "publicShares", String(shareId || "")));
  if (!snapshot.exists()) throw new Error("Tautan share tidak ditemukan.");
  const data = snapshot.data();
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error("Tautan share sudah kedaluwarsa.");
  return { ...data, expiresAt: expiresAt.toISOString() };
}
