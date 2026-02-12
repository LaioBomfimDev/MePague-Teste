import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "PLACEHOLDER",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "PLACEHOLDER",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "PLACEHOLDER",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "PLACEHOLDER",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "PLACEHOLDER",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "PLACEHOLDER"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
