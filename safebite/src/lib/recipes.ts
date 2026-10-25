// One place to look up a recipe by id, whether it's TheMealDB's or one a user
// wrote. User recipes are "u_" + their Firestore id, everywhere in the app
// (URLs, saved, recently viewed, meal logs).
import { FirebaseError } from 'firebase/app'
import { getMeal, type Meal } from '../api/mealdb'
import { getUserRecipe, getUserRecipes } from './db'
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
  userRecipe: { ownerId: r.ownerId, shared: r.shared },
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

// Whether a recipe has every search term in its name or ingredients (for the Recipes page search).
export function matchesTerms(meal: Meal, terms: string[]) {
  const text = [meal.name, ...meal.ingredients.map((i) => i.name)].join(' ').toLowerCase()
  return terms.every((t) => text.includes(t.toLowerCase()))
}
