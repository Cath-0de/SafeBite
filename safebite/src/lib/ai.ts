// Gemini, through Firebase AI Logic: Firebase holds the Gemini key, so none is
// in this code. Calls are checked by App Check (set up in firebase.ts).
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from './firebase'
import { ALLERGENS } from './allergens'

// Change this when Google retires the model (see the AI Logic page in the Firebase console).
// Flash-lite: faster, and its free-tier daily limit is separate from plain Flash's (only 20/day).
const MODEL = 'gemini-3.5-flash-lite'

const ai = app ? getAI(app, { backend: new GoogleAIBackend() }) : null

const model = ai
  ? getGenerativeModel(
      ai,
      {
        model: MODEL,
        // Make Gemini answer in exactly this JSON shape.
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: Schema.object({
            properties: {
              known: Schema.array({ items: Schema.enumString({ enum: ALLERGENS.map((a) => a.id) }) }),
              other: Schema.array({ items: Schema.string() }),
            },
          }),
        },
      },
      // The SDK waits 3 minutes by default; the free tier is sometimes that slow,
      // so give up sooner and let the user retry or type the food's name instead.
      { timeout: 20_000 },
    )
  : null

// Turns a sentence like "milk makes me sick and I'm allergic to prawns" into
// allergen ids from lib/allergens.ts ("dairy", "shellfish") plus short names
// for anything not on that list ("kiwi").
export async function parseAllergies(text: string): Promise<string[]> {
  if (!model) throw new Error('Firebase is not configured')
  const prompt = `A user described their food allergies or intolerances. Put each food they react to in "known" if it
matches one of these ids: ${ALLERGENS.map((a) => `${a.id} (${a.label})`).join(', ')}.
Put anything else in "other" as a short lowercase food name (1-3 words). Ignore anything that isn't a food they react to.

User's description: """${text}"""`
  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text()) as { known?: unknown; other?: unknown }

  // Don't trust the reply's shape: keep only real ids and short plain strings.
  const ids = new Set<string>(ALLERGENS.map((a) => a.id))
  const known = (Array.isArray(parsed.known) ? parsed.known : []).filter((k): k is string => typeof k === 'string' && ids.has(k))
  const other = (Array.isArray(parsed.other) ? parsed.other : [])
    .filter((o): o is string => typeof o === 'string')
    .map((o) => o.trim().toLowerCase())
    .filter((o) => o && o.length <= 50)
  return [...new Set([...known, ...other])].slice(0, 20)
}

// ---- Finding a product's ingredients on the web (Scan page fallback) ----

// Gemini with Google Search turned on, so it looks the product up instead of guessing.
// Search grounding can't be combined with a JSON schema, so it answers in a fixed text format.
const searchModel = ai ? getGenerativeModel(ai, { model: MODEL, tools: [{ googleSearch: {} }] }, { timeout: 30_000 }) : null

export interface WebProduct {
  name: string
  brand: string
  ingredientsText: string
  sources: { title: string; uri: string }[] // the pages Google Search found
  searchSuggestions: string // Google's required "search suggestions" HTML; show it alongside the result
}

// Asks Gemini to search the web for a product's ingredient list. Returns null
// when it can't find this exact product. The answer can be wrong, so callers
// must say so and never treat it as "safe".
export async function findProductOnline(barcode: string, known?: { name: string; brand: string }): Promise<WebProduct | null> {
  if (!searchModel) throw new Error('Firebase is not configured')
  // Only digits go into the prompt from the barcode box.
  if (!/^\d{6,14}$/.test(barcode)) throw new Error("That doesn't look like a barcode number")
  const what = known?.name
    ? `the product "${known.name}"${known.brand ? ` by ${known.brand}` : ''} (barcode ${barcode})`
    : `the product with the barcode (UPC/EAN) ${barcode}`
  const prompt = `Search the web for ${what} and find its ingredient list as printed on the packaging.
Reply in exactly this format and nothing else:
NAME: <product name>
BRAND: <brand, or leave blank>
INGREDIENTS: <the ingredient list, comma separated>
If you can't find this exact product's ingredients, reply only: NOT FOUND`
  const result = await searchModel.generateContent(prompt)
  const text = result.response.text()
  if (/NOT FOUND/i.test(text)) return null
  // One "KEY: value" line; tolerates markdown like "**NAME:**".
  const field = (key: string, max: number) =>
    (text.match(new RegExp(`^[ \\t*]*${key}[ \\t*]*:(.*)$`, 'im'))?.[1] ?? '').replace(/^[\s*]+|[\s*]+$/g, '').slice(0, max)
  const ingredientsText = field('INGREDIENTS', 3000)
  if (!ingredientsText) return null
  const meta = result.response.candidates?.[0]?.groundingMetadata
  return {
    name: field('NAME', 300) || known?.name || 'Unknown product',
    brand: field('BRAND', 200) || known?.brand || '',
    ingredientsText,
    sources: (meta?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ title: c.web.title || c.web.uri, uri: c.web.uri }] : [])),
    searchSuggestions: meta?.searchEntryPoint?.renderedContent ?? '',
  }
}
