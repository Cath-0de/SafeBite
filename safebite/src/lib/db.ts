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

function requireDb() {
  if (!db) throw new Error('Firebase is not configured')
  return db
}

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
      createdAt: serverTimestamp(),
      allergens: [],
      currentState: 'remission',
      energyLevel: 'medium',
      updatedAt: serverTimestamp(),
    })
  })
  return (await getDoc(ref)).data() as Profile
}

export type ProfileUpdate = Partial<Pick<Profile, 'allergens' | 'currentState' | 'energyLevel'>>

export async function updateProfile(uid: string, changes: ProfileUpdate) {
  await updateDoc(profileRef(uid), { ...changes, updatedAt: serverTimestamp() })
}

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

export async function getTriggers(uid: string): Promise<Triggers | null> {
  const snap = await getDoc(doc(requireDb(), 'profiles', uid, 'triggers', 'current'))
  return snap.exists() ? (snap.data() as Triggers) : null
}

export async function getIngredientRules() {
  const snap = await getDocs(collection(requireDb(), 'rules'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IngredientRule) }))
}
