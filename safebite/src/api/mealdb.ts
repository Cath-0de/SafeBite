// Recipe data from TheMealDB (free, no API key). Recipes are fetched fresh
// each time and are not stored in Firestore.
const BASE = 'https://www.themealdb.com/api/json/v1/1'

// A recipe in the shape the rest of the app uses.
export interface Meal {
  id: string
  name: string
  category: string
  area: string
  thumbnail: string
  instructions: string
  ingredients: { name: string; measure: string }[]
  tags: string[]
  // Links the API may or may not have for a recipe.
  youtube?: string
  source?: string
}

// A recipe as the API sends it. Ingredients arrive as 20 numbered fields
// (strIngredient1..20, strMeasure1..20), covered by the index signature.
interface RawMeal {
  idMeal: string
  strMeal: string
  strCategory: string
  strArea: string
  strMealThumb: string
  strInstructions: string
  strTags: string | null
  strYoutube: string | null
  strSource: string | null
  [key: string]: string | null
}

// Converts the API's shape into a Meal, collecting the numbered ingredient
// fields into one list and skipping the empty ones.
function toMeal(raw: RawMeal): Meal {
  const ingredients: Meal['ingredients'] = []
  for (let i = 1; i <= 20; i++) {
    const name = raw[`strIngredient${i}`]?.trim()
    if (name) ingredients.push({ name, measure: raw[`strMeasure${i}`]?.trim() ?? '' })
  }
  return {
    id: raw.idMeal,
    name: raw.strMeal,
    category: raw.strCategory,
    area: raw.strArea,
    thumbnail: raw.strMealThumb,
    instructions: raw.strInstructions,
    ingredients,
    // Tags arrive as one comma-separated string ("Pasta,Curry").
    tags: raw.strTags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
    youtube: raw.strYoutube || undefined,
    source: raw.strSource || undefined,
  }
}

// A multi-item search can need dozens of requests, and the API answers 429
// ("too many requests") if they all go at once. So: at most MAX_PARALLEL
// requests run at a time, a 429 is retried after a short wait, and every
// answer is remembered for the rest of the visit (the data rarely changes).
const MAX_PARALLEL = 6
const RETRY_DELAYS_MS = [500, 1500, 3000]
const cache = new Map<string, Promise<unknown>>()
let running = 0
const waiting: (() => void)[] = []

async function getJson<T>(path: string): Promise<T> {
  let request = cache.get(path) as Promise<T> | undefined
  if (!request) {
    request = throttled(path)
    cache.set(path, request)
    // Don't remember failures, so the next search tries again.
    request.catch(() => cache.delete(path))
  }
  return request
}

async function throttled<T>(path: string): Promise<T> {
  // Wait for a free slot; a finishing request hands its slot to the next in line.
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  else running++
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${BASE}/${path}`)
      if (res.ok) return await res.json()
      if (res.status !== 429 || attempt >= RETRY_DELAYS_MS.length) {
        throw new Error(`TheMealDB request failed (${res.status})`)
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  } finally {
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

// Calls an endpoint that returns full recipes. The API sends null when nothing matches.
async function fetchMeals(path: string): Promise<Meal[]> {
  const data = await getJson<{ meals: RawMeal[] | null }>(path)
  return (data.meals ?? []).map(toMeal)
}

// filter.php returns only id, name and thumbnail, so callers look up the full recipe by id.
async function fetchMealIds(path: string): Promise<string[]> {
  const data = await getJson<{ meals: { idMeal: string }[] | null }>(path)
  return (data.meals ?? []).map((m) => m.idMeal)
}

// The API's lists of every ingredient, cuisine ("area") and category name.
const LIST_FIELD = { i: 'strIngredient', a: 'strArea', c: 'strCategory' } as const
async function listNames(kind: 'i' | 'a' | 'c'): Promise<string[]> {
  const data = await getJson<{ meals: Record<string, string>[] }>(`list.php?${kind}=list`)
  return data.meals.map((m) => m[LIST_FIELD[kind]])
}

// Splits "steak and pasta", "steak, pasta" or "chicken + rice & garlic" into separate items.
export function parseTerms(query: string): string[] {
  const terms = query.toLowerCase().split(/,|\+|&|\band\b|\bwith\b/).map((t) => t.trim())
  return [...new Set(terms.filter(Boolean))]
}

// Lowercases and roughly singularizes each word, so "Tomatoes" and "tomato"
// (or "cheeses" and "cheese") compare equal.
const stems = (text: string) =>
  text.toLowerCase().split(/[^a-z]+/).filter(Boolean).map((w) => w.replace(/s$/, '').replace(/e$/, ''))

// True if every word of `term` appears, in order, as whole words in `text`
// ("chicken breast" is in "Chicken Breasts"; "egg" is not in "Eggplant").
function hasWords(text: string, term: string) {
  return ` ${stems(text).join(' ')} `.includes(` ${stems(term).join(' ')} `)
}

// True if `text` is exactly `term`, ignoring case and plurals ("Desserts" is "dessert").
const sameWords = (text: string, term: string) => stems(text).join(' ') === stems(term).join(' ')

// Ingredients made from something rather than the thing itself. "chicken" should
// not match "Chicken Stock" unless the user typed "stock" too.
const DERIVED = new Set(stems('stock cube bouillon broth sauce vinegar wine ketchup puree paste gravy concentrate powder granules extract oil krispies noodles'))

// Ingredient names the API files under other words ("pasta" recipes often just list "Spaghetti").
const RELATED: Record<string, string[]> = {
  pasta: ['spaghetti', 'penne', 'linguine', 'fettuccine', 'tagliatelle', 'macaroni', 'lasagne', 'rigatoni', 'farfalle'],
  steak: ['sirloin'],
}

// Every ingredient name in the API that counts as `term`.
function ingredientsFor(term: string, all: string[]): string[] {
  const termStems = new Set(stems(term))
  const wanted = [term, ...(RELATED[term] ?? [])]
  return all.filter(
    (name) =>
      wanted.some((w) => hasWords(name, w)) &&
      !stems(name).some((w) => DERIVED.has(w) && !termStems.has(w)),
  )
}

// Loads the three name lists used to interpret search items.
async function vocabulary() {
  const [ingredients, areas, categories] = await Promise.all([listNames('i'), listNames('a'), listNames('c')])
  return { ingredients, areas, categories }
}
type Vocabulary = Awaited<ReturnType<typeof vocabulary>>

// "italian chicken" has no separator, but isn't an ingredient, category or
// cuisine either, so it is treated as two items. "chicken breast" stays whole.
function splitUnknownPhrases(terms: string[], vocab: Vocabulary): string[] {
  const known = (t: string) =>
    ingredientsFor(t, vocab.ingredients).length > 0 ||
    vocab.areas.some((a) => sameWords(a, t)) ||
    vocab.categories.some((c) => sameWords(c, t))
  const split = terms.flatMap((t) => (t.includes(' ') && !known(t) ? t.split(/\s+/) : [t]))
  return [...new Set(split)]
}

// Finds every recipe matching one item, by ingredient, name, category or cuisine.
// filter.php only returns ids; search.php returns full recipes, kept in `byName`.
async function matchTerm(term: string, vocab: Vocabulary) {
  const area = vocab.areas.find((a) => sameWords(a, term))
  const category = vocab.categories.find((c) => sameWords(c, term))
  const enc = encodeURIComponent
  const [named, ...idLists] = await Promise.all([
    fetchMeals(`search.php?s=${enc(term)}`),
    category ? fetchMealIds(`filter.php?c=${enc(category)}`) : [],
    area ? fetchMealIds(`filter.php?a=${enc(area)}`) : [],
    ...ingredientsFor(term, vocab.ingredients).map((name) => fetchMealIds(`filter.php?i=${enc(name)}`)),
  ])
  // search.php matches any part of a name ("egg" finds "Eggplant"), so keep whole-word matches only.
  const byName = named.filter((m) => hasWords(m.name, term))
  return { byName, ids: new Set([...byName.map((m) => m.id), ...idLists.flat()]) }
}

// Each match the name searches didn't already return costs one lookup request,
// so only fetch this many full recipes.
const MAX_LOOKUPS = 24

export interface SearchResult {
  meals: Meal[]
  // How many recipes matched in total; can be more than `meals` holds.
  total: number
  // The separate items the query was split into, and any that matched no recipe at all.
  terms: string[]
  unmatched: string[]
  // True when no recipe has every item, so `meals` holds the recipes with the most of them.
  partial: boolean
}

// Finds recipes that match every item in the query ("steak and pasta" means
// recipes with both). If none do, returns the recipes matching the most items.
// Recipes whose names contain the items come first.
export async function searchMeals(query: string): Promise<SearchResult> {
  const vocab = await vocabulary()
  const terms = splitUnknownPhrases(parseTerms(query), vocab)
  // Also look up the whole phrase as a name, so "mac and cheese" still finds
  // "Mac and Cheese" even though "mac" alone isn't an ingredient.
  const [matches, phrase] = await Promise.all([
    Promise.all(terms.map((t) => matchTerm(t, vocab))),
    terms.length > 1 ? fetchMeals(`search.php?s=${encodeURIComponent(query.trim())}`) : [],
  ])
  const unmatched = terms.filter((_, i) => matches[i].ids.size === 0)

  // Count how many items each recipe matches, and keep the recipes with the
  // highest count: every item if possible, otherwise as many as any recipe has.
  const hits = new Map<string, number>()
  for (const m of matches) for (const id of m.ids) hits.set(id, (hits.get(id) ?? 0) + 1)
  const best = Math.max(0, ...hits.values())
  const partial = terms.length > 1 && best < terms.length
  const ids = [...new Set([...phrase.map((m) => m.id), ...[...hits].filter(([, n]) => n === best).map(([id]) => id)])]

  // Rank by how many items appear in the recipe's name.
  const known = new Map([...phrase, ...matches.flatMap((m) => m.byName)].map((m) => [m.id, m]))
  const nameHits = (id: string) => matches.filter((m) => m.byName.some((n) => n.id === id)).length
  ids.sort((a, b) => nameHits(b) - nameHits(a))

  // Use recipes we already have in full, and look up the rest (up to the cap).
  const toLookUp = ids.filter((id) => !known.has(id)).slice(0, MAX_LOOKUPS)
  const looked = await Promise.all(toLookUp.map((id) => fetchMeals(`lookup.php?i=${id}`)))
  looked.flat().forEach((m) => known.set(m.id, m))
  const meals = ids.flatMap((id) => known.get(id) ?? [])
  return { meals, total: ids.length, terms, unmatched, partial: partial && phrase.length === 0 }
}

// One full recipe by id, or undefined if the id doesn't exist.
export const getMeal = async (id: string): Promise<Meal | undefined> =>
  (await fetchMeals(`lookup.php?i=${encodeURIComponent(id)}`))[0]

// An empty name search returns the API's default page of recipes.
export const browseMeals = () => fetchMeals('search.php?s=')

// One random recipe (not used by any page yet).
export const randomMeal = async () => (await fetchMeals('random.php'))[0]
