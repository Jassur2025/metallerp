import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDIRTBl3cP2rXm0WIRVoybh3LhXxHzMGqU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "metalmaster-erp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "metalmaster-erp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "metalmaster-erp.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "94610773582",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:94610773582:web:79b509a2b571e97efdd51f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
