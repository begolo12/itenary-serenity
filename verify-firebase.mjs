import { doc, getDoc, terminate } from "firebase/firestore";
import { db, firebaseApp } from "./src/lib/firebase.js";

const projectId = firebaseApp.options.projectId;
console.log(`Firebase initialized for ${projectId}`);

try {
  await getDoc(doc(db, "_health", "connection"));
  console.log("Firestore endpoint reached successfully");
} catch (error) {
  if (error?.code === "permission-denied") {
    console.log("Firestore endpoint reached; unauthenticated reads are correctly denied");
  } else {
    throw error;
  }
} finally {
  await terminate(db);
}
