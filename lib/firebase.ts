import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDIRTBl3cP2rXm0WIRVoybh3LhXxHzMGqU",
  authDomain: "metalmaster-erp.firebaseapp.com",
  projectId: "metalmaster-erp",
  storageBucket: "metalmaster-erp.firebasestorage.app",
  messagingSenderId: "94610773582",
  appId: "1:94610773582:web:79b509a2b571e97efdd51f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
