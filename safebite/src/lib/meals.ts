// The answer choices for the meal log (Log.tsx, LogMealDialog.tsx).
import type { MealType } from './schema'

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
]

// The feelings to pick from. `score` is what's stored as symptomScore (0 = no symptoms, 10 = worst).
export const RATINGS = [
  { score: 0, symbol: '😊', label: 'Great' },
  { score: 3, symbol: '🙂', label: 'Fine' },
  { score: 5, symbol: '😐', label: 'Meh' },
  { score: 8, symbol: '😣', label: 'Unwell' },
  { score: 10, symbol: '😫', label: 'Awful' },
]

// Turns the ingredients box ("Chicken, rice" plus new lines) into the stored
// list: lowercase, trimmed, no blanks or repeats, within firestore.rules' limits.
export function parseIngredients(text: string): string[] {
  const names = text.split(/[,;\n]/).map((s) => s.trim().toLowerCase().slice(0, 100)).filter(Boolean)
  return [...new Set(names)].slice(0, 100)
}
