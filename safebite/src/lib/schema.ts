import type { Timestamp } from 'firebase/firestore'

// Firestore document shapes. firestore.rules enforces the same fields and
// enums, so keep the two in sync when either changes.

// The only values allowed for the two health toggles.
export type CurrentState = 'flare' | 'remission'
export type EnergyLevel = 'low' | 'medium' | 'high'

// profiles/{uid}: one document per user, keyed by their Firebase Auth uid.
export interface Profile {
  email: string
  name: string // empty until the user answers the setup questions
  createdAt: Timestamp
  allergens: string[] // ids from lib/allergens.ts, plus any allergies the user typed in (lowercase)
  hasUC?: boolean // missing on profiles made before the question existed; treat as true
  currentState: CurrentState
  energyLevel: EnergyLevel
  updatedAt: Timestamp // equals createdAt until the setup form is first saved
}

// profiles/{uid}/recent/{mealId}: a recipe the user opened, for "continue where you left off".
export interface RecentRecipe {
  name: string
  thumbnail: string
  viewedAt: Timestamp
}

// profiles/{uid}/saved/{mealId}: a recipe the user starred.
export interface SavedRecipe {
  name: string
  thumbnail: string
  savedAt: Timestamp
}

// profiles/{uid}/logs/{logId}: one logged meal with its symptom score.
export interface MealLog {
  loggedAt: Timestamp
  mealDescription: string
  ingredients?: string[]
  symptomScore: number // 0-10
  notes?: string
}

// profiles/{uid}/variants/{variantId}: a recipe plus the ingredient swaps the user chose.
export interface Swap {
  original: string
  substitute: string
}

export interface RecipeVariant {
  baseRecipeId: string
  baseRecipeName: string
  swaps: Swap[]
  createdAt: Timestamp
}

// profiles/{uid}/triggers/current (written by the ML pipeline, read-only to the client)
export interface Triggers {
  ingredientWeights: Record<string, number> // ingredient -> how strongly it correlates with symptoms
  lastTrainedAt: Timestamp
  loggedMealCount: number
}

// rules/{ruleId} (curated shared reference data, read-only to the client)
export interface IngredientRule {
  ingredientName: string
  category: string
  flareUnsafe: boolean // true = hide or flag this ingredient during a flare-up
  matchesAllergenTags: string[] // allergen ids (lib/allergens.ts) this ingredient counts as
  safeSubstitutes: string[] // what the swapper offers instead
}
