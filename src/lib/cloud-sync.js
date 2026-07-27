import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
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
  await withRetry(() => setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email || null,
    authType: user.isAnonymous ? "anonymous" : "password",
    updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "workspaces", user.uid), {
    name: "Workspace Pribadi", createdBy: user.uid, createdAt: now, updatedAt: now,
  }, { merge: true }));
  await withRetry(() => setDoc(doc(db, "workspaces", user.uid, "members", user.uid), {
    uid: user.uid, role: "owner", joinedAt: now,
  }, { merge: true }));
}

export { withRetry };

function cloudTrip(trip, uid) {
  const { photo, ...safeTrip } = trip;
  return { ...safeTrip, workspaceId: uid, createdBy: uid, hasPhoto: Boolean(photo) };
}

export async function saveCloudTrip(uid, trip) {
  requireCloud();
  await setDoc(doc(db, "workspaces", uid, "trips", trip.id), cloudTrip(trip, uid));
  const photoRef = doc(db, "workspaces", uid, "trips", trip.id, "photos", "cover");
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

export async function deleteCloudTrip(uid, tripId) {
  requireCloud();
  await deleteDoc(doc(db, "workspaces", uid, "trips", tripId, "photos", "cover"));
  await deleteDoc(doc(db, "workspaces", uid, "trips", tripId));
}

export function watchCloudTrips(uid, onTrips, onError) {
  return onSnapshot(collection(db, "workspaces", uid, "trips"), async (snapshot) => {
    try {
      const trips = await Promise.all(snapshot.docs.map(async (item) => {
        const trip = item.data();
        if (!trip.hasPhoto) return { ...trip, photo: null };
        const photo = await getDoc(doc(db, "workspaces", uid, "trips", item.id, "photos", "cover"));
        return { ...trip, photo: photo.exists() ? photo.data() : null };
      }));
      onTrips(trips);
    } catch (error) {
      onError(error);
    }
  }, onError);
}
