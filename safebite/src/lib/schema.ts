import type { Timestamp } from 'firebase/firestore'

// Firestore document shapes. firestore.rules enforces the same fields and
// enums, so keep the two in sync when either changes.

export type CurrentState = 'flare' | 'remission'
export type EnergyLevel = 'low' | 'medium' | 'high'

// profiles/{uid}
export interface Profile {
  email: string
  createdAt: Timestamp
  allergens: string[]
  currentState: CurrentState
  energyLevel: EnergyLevel
  updatedAt: Timestamp
}

// profiles/{uid}/logs/{logId}
export interface MealLog {
  loggedAt: Timestamp
  mealDescription: string
  ingredients?: string[]
  symptomScore: number // 0-10
  notes?: string
}

// profiles/{uid}/variants/{variantId}
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
  ingredientWeights: Record<string, number>
  lastTrainedAt: Timestamp
  loggedMealCount: number
}

// rules/{ruleId} (curated shared reference data, read-only to the client)
export interface IngredientRule {
  ingredientName: string
  category: string
  flareUnsafe: boolean
  matchesAllergenTags: string[]
  safeSubstitutes: string[]
}
