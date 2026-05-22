import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAPLyLuw3X5NuWmRAmSUsGrSxFS7LgzUpE",
  authDomain: "qr-managment.firebaseapp.com",
  projectId: "qr-managment",
  storageBucket: "qr-managment.firebasestorage.app",
  messagingSenderId: "454603953826",
  appId: "1:454603953826:web:518d9dbc7116c95910a9fb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
