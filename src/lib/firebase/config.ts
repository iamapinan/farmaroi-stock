
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpuQzxhwX0N1OGVkfZBwcD9KqL_GfCn88",
  authDomain: "farm-aroi-stock-db.firebaseapp.com",
  projectId: "farm-aroi-stock-db",
  storageBucket: "farm-aroi-stock-db.firebasestorage.app",
  messagingSenderId: "572731609752",
  appId: "1:572731609752:web:33bb0fff7566386f2cb6ed",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
