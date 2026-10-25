// Connects the app to the Firebase project. Exports `auth` (sign-in) and `db`
// (Firestore database), which the rest of the app imports from here.
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// The project's keys, read from .env.local (see .env.example for the names).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// False when .env.local is missing, so the app can show a message instead of crashing.
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = firebaseConfigured ? initializeApp(firebaseConfig) : null

// App Check proves requests come from this site, so others can't spend the
// Gemini quota (lib/ai.ts). Skipped if VITE_RECAPTCHA_SITE_KEY isn't set.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (app && recaptchaKey) {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaKey), isTokenAutoRefreshEnabled: true })
}

// Both are null when Firebase isn't configured, so callers check before using them.
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
