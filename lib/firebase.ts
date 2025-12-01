import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Get environment variables - throw error if missing in production
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key];
  if (!value && !fallback) {
    if (import.meta.env.PROD) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    console.warn(`Warning: Environment variable ${key} is not set. Using fallback.`);
  }
  return value || fallback || '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', import.meta.env.DEV ? "AIzaSyDIRTBl3cP2rXm0WIRVoybh3LhXxHzMGqU" : undefined),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.DEV ? "metalmaster-erp.firebaseapp.com" : undefined),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', import.meta.env.DEV ? "metalmaster-erp" : undefined),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.DEV ? "metalmaster-erp.firebasestorage.app" : undefined),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.DEV ? "94610773582" : undefined),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', import.meta.env.DEV ? "1:94610773582:web:79b509a2b571e97efdd51f" : undefined)
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
