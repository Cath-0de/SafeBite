// One place to look up a recipe by id, whether it's TheMealDB's or one a user
// wrote. User recipes are "u_" + their Firestore id, everywhere in the app
// (URLs, saved, recently viewed, meal logs).
import { FirebaseError } from 'firebase/app'
import { getMeal, hasWords, type Meal } from '../api/mealdb'
import { findRecipesOnline } from './ai'
import { allergenLabel, allergensIn, maybeAllergensIn, type Allergies } from './allergens'
import { addUserRecipe, getUserRecipe, getUserRecipes } from './db'
import type { UserRecipe } from './schema'

export const USER_RECIPE_PREFIX = 'u_'

export const isUserRecipeId = (id: string) => id.startsWith(USER_RECIPE_PREFIX)

// A user recipe in the same shape as TheMealDB's, so the same pages and cards show it.
const toMeal = (r: UserRecipe & { id: string }): Meal => ({
  id: USER_RECIPE_PREFIX + r.id,
  name: r.name,
  category: r.category,
  area: r.area,
  thumbnail: '', // shortcut: no photos yet; add Firebase Storage uploads if users want them
  instructions: r.instructions,
  ingredients: r.ingredients,
  tags: r.tags,
  source: r.sourceUrl,
  userRecipe: { ownerId: r.ownerId, shared: r.shared, ai: r.source === 'ai' },
})

// A recipe by id; undefined if it doesn't exist or the user can't see it
// (someone else's private recipe, or any user recipe while signed out).
export async function getRecipe(id: string): Promise<Meal | undefined> {
  if (!isUserRecipeId(id)) return getMeal(id)
  try {
    const r = await getUserRecipe(id.slice(USER_RECIPE_PREFIX.length))
    return r ? toMeal(r) : undefined
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'permission-denied') return undefined
    throw err
  }
}

// The user's own recipes and everyone's shared ones, newest first.
export const listUserRecipes = async (uid: string) => (await getUserRecipes(uid)).map(toMeal)

// Whether any of the user's allergies is in a recipe's ingredients.
export const hasAllergen = (meal: Meal, a: Allergies) => allergensIn(a, meal.ingredients.map((i) => i.name)).length > 0

// Whether a recipe has what a search said to leave out ("gluten free"). Stricter
// than hasAllergen: someone asking for gluten free shouldn't get plain flour.
export const hasExcluded = (meal: Meal, excluded: Allergies) =>
  hasAllergen(meal, excluded) || maybeAllergensIn(excluded, meal.ingredients.map((i) => i.name)).length > 0

// Remembered for the visit, so re-renders and going back don't search or save twice.
const lookups = new Map<string, Promise<Meal[]>>()

// Searches the web for recipes the database lacks and stores them as shared
// recipes, so later searches find them without using the AI. `database` and
// `stored` are the recipes already found and already in Firestore, to avoid
// saving the same recipe again.
export function lookUpRecipes(uid: string, query: string, a: Allergies, database: Meal[], stored: Meal[]): Promise<Meal[]> {
  const key = JSON.stringify([uid, query, a.allergens])
  let request = lookups.get(key)
  if (!request) {
    request = findAndStore(uid, query, a, database, stored)
    lookups.set(key, request)
    // Don't remember failures, so the next search tries again.
    request.catch(() => lookups.delete(key))
  }
  return request
}

async function findAndStore(uid: string, query: string, a: Allergies, database: Meal[], stored: Meal[]) {
  const nameOf = (m: { name: string }) => m.name.toLowerCase()
  // A database recipe with the user's allergy doesn't count as a duplicate of a safe version.
  const inDatabase = new Set(database.filter((m) => !hasAllergen(m, a)).map(nameOf))
  const existing = new Map(stored.filter((m) => m.userRecipe?.ai).map((m) => [nameOf(m), m]))
  const found = await findRecipesOnline(query, a.allergens.map(allergenLabel))
  // The AI was told to avoid these, but check its answer anyway (steps can mention more than the list).
  const fresh = found.filter((r) => !inDatabase.has(nameOf(r)) && !allergensIn(a, [...r.ingredients.map((i) => i.name), r.instructions]).length)
  const meals = await Promise.all(fresh.map(async (r) => {
    const already = existing.get(nameOf(r))
    if (already) return already
    const ref = await addUserRecipe(uid, {
      name: r.name,
      category: r.category,
      area: r.area,
      instructions: r.instructions,
      ingredients: r.ingredients,
      tags: [],
      shared: true,
      source: 'ai',
      sourceUrl: r.url || undefined,
    })
    const saved = await getUserRecipe(ref.id)
    return saved ? toMeal(saved) : null
  }))
  return meals.filter((m) => m !== null)
}

// Whether a recipe has every search term in its name, ingredients, category or
// cuisine (for the Recipes page search), matched the way TheMealDB searches are.
export function matchesTerms(meal: Meal, terms: string[]) {
  const texts = [meal.name, meal.category, meal.area, ...meal.ingredients.map((i) => i.name)]
  return terms.every((t) => texts.some((text) => hasWords(text, t)))
}
