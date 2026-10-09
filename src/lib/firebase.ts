import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// getApps()/getApp() guards against "app already initialized" errors that
// can happen with React Native's fast-refresh during development
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Module scope runs once per load, but fast refresh can re-execute it while
// the first auth instance is still alive — fall back to it instead of
// throwing "auth/already-initialized".
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  if ((e as { code?: unknown })?.code !== "auth/already-initialized") throw e;
  auth = getAuth(app);
}

export { auth };

export const db = getFirestore(app);
