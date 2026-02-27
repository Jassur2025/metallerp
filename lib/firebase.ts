import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  Timestamp,
  serverTimestamp,
  limit
} from "firebase/firestore";

// Get environment variables - use fallback if not set
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key];
  if (!value && !fallback) {
    // Use console directly here since logger depends on app initialization
    console.warn(`[firebase] Environment variable ${key} is not set.`);
    return '';
  }
  return value || fallback || '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID')
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with persistent local cache (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Export Firestore utilities
export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  Timestamp,
  serverTimestamp,
  limit
};

// Устанавливаем persistence для мобильных устройств
setPersistence(auth, browserLocalPersistence).catch((error) => {
  // Use console directly here since logger depends on app initialization
  console.warn('[firebase] Error setting persistence:', error);
});

export const googleProvider = new GoogleAuthProvider();

// Дополнительные параметры для мобильных устройств
googleProvider.setCustomParameters({
  prompt: 'select_account', // Позволяет выбрать аккаунт
});
