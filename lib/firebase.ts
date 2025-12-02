import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";

// Get environment variables - use fallback if not set
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key];
  if (!value && !fallback) {
    console.warn(`Warning: Environment variable ${key} is not set. Please configure it in GitHub Secrets.`);
    return '';
  }
  return value || fallback || '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', import.meta.env.DEV ? "AIzaSyDIRTBl3cP2rXm0WIRVoybh3LhXxHzMGqU" : "AIzaSyDIRTBl3cP2rXm0WIRVoybh3LhXxHzMGqU"),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.DEV ? "metalmaster-erp.firebaseapp.com" : "metalmaster-erp.firebaseapp.com"),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', import.meta.env.DEV ? "metalmaster-erp" : "metalmaster-erp"),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.DEV ? "metalmaster-erp.firebasestorage.app" : "metalmaster-erp.firebasestorage.app"),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.DEV ? "94610773582" : "94610773582"),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', import.meta.env.DEV ? "1:94610773582:web:79b509a2b571e97efdd51f" : "1:94610773582:web:79b509a2b571e97efdd51f")
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Устанавливаем persistence для мобильных устройств
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Дополнительные параметры для мобильных устройств
googleProvider.setCustomParameters({
  prompt: 'select_account', // Позволяет выбрать аккаунт
});
