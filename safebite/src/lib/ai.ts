// Gemini, through Firebase AI Logic: Firebase holds the Gemini key, so none is
// in this code. Calls are checked by App Check (set up in firebase.ts).
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from './firebase'
import { ALLERGENS } from './allergens'

// Change this when Google retires the model (see the AI Logic page in the Firebase console).
// Flash-lite: faster, and its free-tier daily limit is separate from plain Flash's (only 20/day).
const MODEL = 'gemini-3.5-flash-lite'

const model = app
  ? getGenerativeModel(
      getAI(app, { backend: new GoogleAIBackend() }),
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
