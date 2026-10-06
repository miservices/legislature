/* ============================================================
   Firebase for the Michigan Legislature site.
   Project: legislature-53807
   1. In the Firebase console enable Authentication > Email/Password.
   2. Create the Firestore database, then publish firestore.rules (Firestore > Rules).
   ============================================================ */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth, setPersistence, browserLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey:            "AIzaSyAsKLywhp_-JI6cccQHxs5gYicjKMXY0QE",
  authDomain:        "legislature-53807.firebaseapp.com",
  projectId:         "legislature-53807",
  storageBucket:     "legislature-53807.firebasestorage.app",
  messagingSenderId: "678393027963",
  appId:             "1:678393027963:web:a55088150ea412f335b1de"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
await setPersistence(auth, browserLocalPersistence);

/* Roles. Change a user's role by editing accounts/<uid>.role in the Firebase console. */
export const PUBLIC_ROLE = "Public Member";
export const ROLES = ["Public Member", "Legislator", "Speaker", "Deputy Speaker", "Speaker Pro Tempore", "Clerk of the Legislature"];
/* Roles that can review proposals and edit the official record (keep in sync with firestore.rules). */
export const ADMIN_ROLES = ["Speaker", "Deputy Speaker", "Speaker Pro Tempore", "Clerk of the Legislature"];

export {
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, writeBatch
};