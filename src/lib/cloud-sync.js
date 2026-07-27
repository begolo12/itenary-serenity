import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInToCloud() {
  return signInAnonymously(auth);
}

export async function createCloudAccount(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithCloudAccount(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutFromCloud() {
  return signOut(auth);
}

export async function bootstrapWorkspace(user) {
  const now = new Date().toISOString();
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email || null,
    authType: user.isAnonymous ? "anonymous" : "password",
    updatedAt: now,
  }, { merge: true });
  await setDoc(doc(db, "workspaces", user.uid), {
    name: "Workspace Pribadi", createdBy: user.uid, createdAt: now, updatedAt: now,
  }, { merge: true });
  await setDoc(doc(db, "workspaces", user.uid, "members", user.uid), {
    uid: user.uid, role: "owner", joinedAt: now,
  }, { merge: true });
}

function cloudTrip(trip, uid) {
  const { photo, ...safeTrip } = trip;
  return { ...safeTrip, workspaceId: uid, createdBy: uid, hasPhoto: Boolean(photo) };
}

export async function saveCloudTrip(uid, trip) {
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
