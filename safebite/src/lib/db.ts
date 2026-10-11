// Every Firestore read and write in the app goes through the functions in
// this file. Document shapes are in schema.ts; access is enforced by firestore.rules.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { IngredientRule, MealLog, Profile, RecipeVariant, Swap, Triggers } from './schema'

// Returns the database, or throws a clear error if Firebase isn't configured.
function requireDb() {
  if (!db) throw new Error('Firebase is not configured')
  return db
}

// ---- Profile: profiles/{uid} ----

// Points at one user's profile document.
const profileRef = (uid: string) => doc(requireDb(), 'profiles', uid)

// Creates profiles/{uid} on first sign-in; returns the existing profile otherwise.
// Runs in a transaction so two concurrent calls can't both try to create it.
export async function ensureProfile(user: User): Promise<Profile> {
  const ref = profileRef(user.uid)
  await runTransaction(requireDb(), async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) return
    tx.set(ref, {
      email: user.email ?? '',
      name: '',
      createdAt: serverTimestamp(),
      allergens: [],
      currentState: 'remission',
      energyLevel: 'medium',
      updatedAt: serverTimestamp(),
    })
  })
  return (await getDoc(ref)).data() as Profile
}

// Reads a profile; null if it doesn't exist.
export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(profileRef(uid))
  return snap.exists() ? (snap.data() as Profile) : null
}

// The profile fields the user is allowed to edit (not email or the timestamps).
export type ProfileUpdate =Partial<Pick<Profile, 'name' | 'allergens' |'currentState' | 'energyLevel'>>

// Saves the changed fields and stamps updatedAt with the server's time.
export async function updateProfile(uid: string, changes: ProfileUpdate) {
  await updateDoc(profileRef(uid), { ...changes, updatedAt: serverTimestamp() })
}

// ---- Meal & symptom logs: profiles/{uid}/logs (no UI uses these yet) ----

export async function addMealLog(
  uid: string,
  log: { loggedAt: Timestamp; mealDescription: string; symptomScore: number; ingredients?: string[]; notes?: string },
) {
  // Firestore rejects undefined values, so drop optional fields that weren't provided.
  const data = Object.fromEntries(Object.entries(log).filter(([, v]) => v !== undefined))
  return addDoc(collection(requireDb(), 'profiles', uid, 'logs'), data)
}

export async function getMealLogs(uid: string) {
  const snap = await getDocs(collection(requireDb(), 'profiles', uid, 'logs'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as MealLog) }))
}

// ---- Recipe variants (ingredient swaps): profiles/{uid}/variants (no UI yet) ----

export async function saveVariant(uid: string, baseRecipeId: string, baseRecipeName: string, swaps: Swap[]) {
  return addDoc(collection(requireDb(), 'profiles', uid, 'variants'), {
    baseRecipeId,
    baseRecipeName,
    swaps,
    createdAt: serverTimestamp(),
  })
}

export async function getVariants(uid: string) {
  const snap = await getDocs(collection(requireDb(), 'profiles', uid, 'variants'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RecipeVariant) }))
}

// ---- Read-only data: ML trigger results and the shared ingredient rules (no UI yet) ----

// The ML script's output for this user; null until it has been run.
export async function getTriggers(uid: string): Promise<Triggers | null> {
  const snap = await getDoc(doc(requireDb(), 'profiles', uid, 'triggers', 'current'))
  return snap.exists() ? (snap.data() as Triggers) : null
}

// The curated ingredient table (allergen tags, flare safety, substitutes) used for filtering.
export async function getIngredientRules() {
  const snap = await getDocs(collection(requireDb(), 'rules'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IngredientRule) }))
}
