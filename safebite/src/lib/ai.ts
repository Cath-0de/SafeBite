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

// The likely ingredients of a typed meal ("chicken soup and toast"), for the meal log.
export async function suggestIngredients(meal: string): Promise<string[]> {
  const { ingredients } = await callWorker<{ ingredients?: unknown }>('/ai/ingredients', { meal })
  return (Array.isArray(ingredients) ? ingredients : []).filter((i): i is string => typeof i === 'string')
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
