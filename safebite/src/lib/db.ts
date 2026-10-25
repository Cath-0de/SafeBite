// Every Firestore read and write in the app goes through the functions in
// this file. Document shapes are in schema.ts; access is enforced by firestore.rules.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { IngredientRule, MealLog, Profile, RecentRecipe, SavedRecipe, RecipeVariant, Swap, Triggers, UserProduct, UserRecipe } from './schema'

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
export type ProfileUpdate =Partial<Pick<Profile, 'name' | 'allergens' | 'hasUC' | 'currentState' | 'energyLevel'>>

// Saves the changed fields and stamps updatedAt with the server's time.
export async function updateProfile(uid: string, changes: ProfileUpdate) {
  await updateDoc(profileRef(uid), { ...changes, updatedAt: serverTimestamp() })
}

// ---- Recently viewed recipes: profiles/{uid}/recent/{mealId} ----

// Keyed by the recipe id, so viewing a recipe again just moves it to the front.
// shortcut: old entries are never deleted, prune if users view hundreds of recipes.
export async function markRecipeViewed(uid: string, meal: { id: string; name: string; thumbnail: string }) {
  await setDoc(doc(requireDb(), 'profiles', uid, 'recent', meal.id), {
    name: meal.name,
    thumbnail: meal.thumbnail,
    viewedAt: serverTimestamp(),
  })
}

// The most recently viewed recipes, newest first.
export async function getRecentRecipes(uid: string, count = 4) {
  const q = query(collection(requireDb(), 'profiles', uid, 'recent'), orderBy('viewedAt', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RecentRecipe) }))
}

// ---- Saved (starred) recipes: profiles/{uid}/saved/{mealId} ----

export async function saveRecipe(uid: string, meal: { id: string; name: string; thumbnail: string }) {
  await setDoc(doc(requireDb(), 'profiles', uid, 'saved', meal.id), {
    name: meal.name,
    thumbnail: meal.thumbnail,
    savedAt: serverTimestamp(),
  })
}

export async function unsaveRecipe(uid: string, mealId: string) {
  await deleteDoc(doc(requireDb(), 'profiles', uid, 'saved', mealId))
}

export async function isRecipeSaved(uid: string, mealId: string) {
  return (await getDoc(doc(requireDb(), 'profiles', uid, 'saved', mealId))).exists()
}

// All saved recipes, newest first.
export async function getSavedRecipes(uid: string) {
  const snap = await getDocs(query(collection(requireDb(), 'profiles', uid, 'saved'), orderBy('savedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SavedRecipe) }))
}

// ---- Meal & symptom logs: profiles/{uid}/logs (Log.tsx) ----

// Firestore rejects undefined values, so drop optional fields that weren't provided.
const withoutUndefined = (data: object) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

export async function addMealLog(uid: string, log: MealLog) {
  return addDoc(collection(requireDb(), 'profiles', uid, 'logs'), withoutUndefined(log))
}

// Replaces the whole entry, so clearing an optional field (notes, recipe) removes it.
export async function updateMealLog(uid: string, logId: string, log: MealLog) {
  await setDoc(doc(requireDb(), 'profiles', uid, 'logs', logId), withoutUndefined(log))
}

export async function deleteMealLog(uid: string, logId: string) {
  await deleteDoc(doc(requireDb(), 'profiles', uid, 'logs', logId))
}

// All logged meals, newest first.
export async function getMealLogs(uid: string) {
  const snap = await getDocs(query(collection(requireDb(), 'profiles', uid, 'logs'), orderBy('loggedAt', 'desc')))
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

// ---- User-added products: products/{barcode} (Scan.tsx) ----

export async function getUserProduct(barcode: string): Promise<UserProduct | null> {
  const snap = await getDoc(doc(requireDb(), 'products', barcode))
  return snap.exists() ? (snap.data() as UserProduct) : null
}

// Creates the product, or updates it if this user added it (firestore.rules blocks editing someone else's).
export async function saveUserProduct(uid: string, barcode: string, product: { name: string; brand: string; ingredientsText: string }) {
  await setDoc(doc(requireDb(), 'products', barcode), { ...product, addedBy: uid, updatedAt: serverTimestamp() })
}

// ---- User recipes: recipes/{recipeId} (RecipeForm.tsx; lib/recipes.ts turns them into Meals) ----

// The fields the recipe form edits (not the owner or timestamps).
export type UserRecipeInput = Pick<UserRecipe, 'name' | 'category' | 'area' | 'instructions' | 'ingredients' | 'tags' | 'shared'>

const recipesCol = () => collection(requireDb(), 'recipes')

// One user recipe; null if it doesn't exist. Throws permission-denied for someone else's private recipe.
export async function getUserRecipe(recipeId: string) {
  const snap = await getDoc(doc(recipesCol(), recipeId))
  return snap.exists() ? { id: snap.id, ...(snap.data() as UserRecipe) } : null
}

// This user's own recipes plus everyone's shared ones, newest first.
// shortcut: loads every shared recipe at once; page through them once there are hundreds.
export async function getUserRecipes(uid: string) {
  const [mine, shared] = await Promise.all([
    getDocs(query(recipesCol(), where('ownerId', '==', uid))),
    getDocs(query(recipesCol(), where('shared', '==', true))),
  ])
  const byId = new Map([...mine.docs, ...shared.docs].map((d) => [d.id, { id: d.id, ...(d.data() as UserRecipe) }]))
  return [...byId.values()].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}

export async function addUserRecipe(uid: string, recipe: UserRecipeInput) {
  return addDoc(recipesCol(), { ...recipe, ownerId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

// Only the owner can update or delete (firestore.rules).
export async function updateUserRecipe(recipeId: string, recipe: UserRecipeInput) {
  await updateDoc(doc(recipesCol(), recipeId), { ...recipe, updatedAt: serverTimestamp() })
}

export async function deleteUserRecipe(recipeId: string) {
  await deleteDoc(doc(recipesCol(), recipeId))
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
