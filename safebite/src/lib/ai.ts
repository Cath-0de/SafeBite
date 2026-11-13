// The AI features, done by Groq through SafeBite's Cloudflare Worker
// (worker/src/index.ts holds the prompts and the key). Every answer here is a
// guess: callers show it as such and let the user check or edit it.
import { callWorker, workerConfigured } from '../api/worker'
import { ALLERGENS } from './allergens'

// False when the worker isn't set up; pages hide their AI buttons then.
export const aiConfigured = workerConfigured

// Turns a sentence like "milk makes me sick and I'm allergic to prawns" into
// allergen ids from lib/allergens.ts ("dairy", "shellfish") plus short names
// for anything not on that list ("kiwi").
export async function parseAllergies(text: string): Promise<string[]> {
  const reply = await callWorker<{ known?: unknown; other?: unknown }>('/ai/allergies', {
    text,
    allergens: ALLERGENS.map((a) => ({ id: a.id, label: a.label })),
  })
  // Don't trust the reply's shape: keep only real ids and short plain strings.
  const ids = new Set<string>(ALLERGENS.map((a) => a.id))
  const known = (Array.isArray(reply.known) ? reply.known : []).filter((k): k is string => typeof k === 'string' && ids.has(k))
  const other = (Array.isArray(reply.other) ? reply.other : [])
    .filter((o): o is string => typeof o === 'string')
    .map((o) => o.trim().toLowerCase())
    .filter((o) => o && o.length <= 50)
  return [...new Set([...known, ...other])].slice(0, 20)
}

// The names a typed-in allergy ("nightshades") goes by on labels, and ones that
// only sometimes contain it. Throws if the AI can't be reached.
export async function suggestAllergyNames(allergy: string): Promise<{ names: string[]; maybe: string[] }> {
  const reply = await callWorker<{ names?: unknown; maybe?: unknown }>('/ai/allergy-names', { allergy })
  const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(0, 20)
  return { names: list(reply.names), maybe: list(reply.maybe) }
}

// What to do about an ingredient someone can't eat in a recipe.
export interface SwapAdvice {
  canOmit: boolean // it can simply be left out
  replacement: string // what to use instead; '' if nothing works
  note: string // amount or how to use it; may be ''
}

// Asks the AI, for each item, whether it can be left out of this recipe and
// what to replace it with, avoiding everything in `avoid`. Keyed by the
// ingredient's lowercase name; items it didn't answer are missing.
export async function suggestSwaps(
  recipe: { name: string; ingredients: { name: string }[] },
  items: { ingredient: string; reason: string }[],
  avoid: string[],
): Promise<Record<string, SwapAdvice>> {
  const { swaps } = await callWorker<{ swaps?: unknown }>('/ai/swaps', {
    recipe: recipe.name,
    ingredients: recipe.ingredients.map((i) => i.name),
    items,
    avoid,
  })
  const out: Record<string, SwapAdvice> = {}
  for (const s of Array.isArray(swaps) ? swaps : []) {
    if (typeof s?.ingredient !== 'string') continue
    out[s.ingredient.toLowerCase()] = {
      canOmit: s.canOmit === true,
      replacement: typeof s.replacement === 'string' ? s.replacement : '',
      note: typeof s.note === 'string' ? s.note : '',
    }
  }
  return out
}

// The likely ingredients of a typed meal ("chicken soup and toast"), for the meal log.
export async function suggestIngredients(meal: string): Promise<string[]> {
  const { ingredients } = await callWorker<{ ingredients?: unknown }>('/ai/ingredients', { meal })
  return (Array.isArray(ingredients) ? ingredients : []).filter((i): i is string => typeof i === 'string')
}

export interface WebRecipe {
  name: string
  category: string
  area: string
  url: string // the page it came from; '' if the search didn't return one
  ingredients: { name: string; measure: string }[]
  instructions: string
}

// Asks the AI to search the web for recipes, leaving out everything in `avoid`.
// The answer can be wrong, so callers must re-check it and never treat it as "safe".
export async function findRecipesOnline(query: string, avoid: string[]): Promise<WebRecipe[]> {
  const { recipes } = await callWorker<{ recipes?: WebRecipe[] }>('/ai/recipes', { query, avoid })
  return Array.isArray(recipes) ? recipes : []
}

export interface WebProduct {
  name: string
  brand: string
  ingredientsText: string
  sources: { title: string; uri: string }[] // the pages the web search found
}

// Asks the AI to search the web for a product's ingredient list. Returns null
// when it can't find this exact product. The answer can be wrong, so callers
// must say so and never treat it as "safe".
export async function findProductOnline(barcode: string, known?: { name: string; brand: string }): Promise<WebProduct | null> {
  if (!/^\d{6,14}$/.test(barcode)) throw new Error("That doesn't look like a barcode number")
  const { product } = await callWorker<{ product: WebProduct | null }>('/ai/product', { barcode, ...known })
  return product
}
