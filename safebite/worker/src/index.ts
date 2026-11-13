// SafeBite's API (Cloudflare Worker). The app calls these routes instead of
// calling services with secret keys directly:
//   GET  /usda?barcode=<digits>  →  { product: { name, brand, ingredientsText } | null }
//   POST /ai/allergies    { text, allergens: [{ id, label }] }  →  { known: string[], other: string[] }
//   POST /ai/ingredients  { meal }                              →  { ingredients: string[] }
//   POST /ai/allergy-names { allergy }                          →  { names: string[], maybe: string[] }
//   POST /ai/swaps        { recipe, ingredients, items: [{ ingredient, reason }], avoid } → { swaps: [{ ingredient, canOmit, replacement, note }] }
//   POST /ai/product      { barcode, name?, brand? }            →  { product: { name, brand, ingredientsText, sources } | null }
//   POST /ai/recipes      { query, avoid }                      →  { recipes: [{ name, category, area, url, ingredients: [{ name, measure }], instructions }] }
// The /ai routes use Groq (console.groq.com). Model names are in wrangler.toml,
// so a retired model can be swapped without changing this code.

interface Env {
  USDA_API_KEY: string // secret: `npx wrangler secret put USDA_API_KEY`, or .dev.vars locally
  GROQ_API_KEY: string // secret: `npx wrangler secret put GROQ_API_KEY`, or .dev.vars locally
  GROQ_TEXT_MODEL: string // wrangler.toml [vars]: for reading text (allergies, meals)
  GROQ_SEARCH_MODEL: string // wrangler.toml [vars]: a Groq model that supports the browser_search tool
  ALLOWED_ORIGINS: string // wrangler.toml [vars]
  LIMITER: RateLimit // wrangler.toml [[ratelimits]]
}

interface UsdaFood {
  description?: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  ingredients?: string
}

// Browsers only let allowed sites read the responses. This stops other websites
// from using the API through their visitors, but not scripts, which can fake
// the Origin header; the rate limit below covers those.
function corsHeaders(origin: string, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  const ok = allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)
  return ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

// A request's input was malformed; becomes a 400 with this message.
class BadRequest extends Error {}
// Groq's free daily or per-minute limit is used up; becomes a 429 the app shows as-is.
class AiLimitReached extends Error {}

const str = (v: unknown, max: number, field: string) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new BadRequest(`${field} must be text of at most ${max} characters`)
  return v.trim()
}
const optionalStr = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ---- USDA FoodData Central ----

// The same barcode can be stored as 12, 13 or 14 digits (UPC-A vs EAN-13 vs
// GTIN-14, padded with zeros), and USDA's search only finds the exact digits.
function barcodeForms(code: string): string[] {
  const bare = code.replace(/^0+/, '')
  return [...new Set([code, bare.padStart(12, '0'), bare.padStart(13, '0'), bare.padStart(14, '0')])]
}

// Looks one barcode up in USDA FoodData Central's branded foods. Only an exact
// barcode match counts: the search is a text search, so other hits can be unrelated products.
async function lookupUsda(code: string, env: Env) {
  const bare = code.replace(/^0+/, '')
  for (const form of barcodeForms(code)) {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
    url.search = new URLSearchParams({ api_key: env.USDA_API_KEY, query: form, dataType: 'Branded', pageSize: '5' }).toString()
    // Cache at Cloudflare for a day, so repeat scans don't use up the USDA quota.
    const res = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } })
    if (!res.ok) throw new Error(`USDA request failed (${res.status})`)
    const data = (await res.json()) as { foods?: UsdaFood[] }
    const food = data.foods?.find((f) => f.gtinUpc?.replace(/^0+/, '') === bare && f.ingredients)
    if (food) {
      return {
        name: food.description ?? 'Unknown product',
        brand: food.brandName || food.brandOwner || '',
        ingredientsText: food.ingredients ?? '',
      }
    }
  }
  return null
}

// ---- Groq ----

interface GroqMessage {
  content?: string | null
  // Filled by Groq's web-searching models: what they looked up.
  executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[]
}

// mode: 'json' asks for a JSON object; 'search' lets the model search the web first
// (Groq's built-in browser_search tool, which can't be combined with JSON mode).
async function groq(env: Env, model: string, prompt: string, mode: 'json' | 'search', maxTokens = 1024): Promise<GroqMessage> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      // Keep each request small: the free tier has a daily token allowance per model.
      reasoning_effort: 'low',
      max_completion_tokens: maxTokens,
      ...(mode === 'json'
        ? { response_format: { type: 'json_object' } }
        : { tools: [{ type: 'browser_search' }], tool_choice: 'required' }),
    }),
  })
  if (!res.ok) {
    console.error('Groq error', res.status, await res.text())
    if (res.status === 429) throw new AiLimitReached('The AI has reached its free usage limit for now. Try again later.')
    throw new Error(`Groq request failed (${res.status})`)
  }
  const data = (await res.json()) as { choices?: { message?: GroqMessage }[]; usage?: { total_tokens?: number } }
  // Shows in `npx wrangler tail`, to see how much of the daily allowance each feature uses.
  console.log(`Groq ${model} (${mode}): ${data.usage?.total_tokens ?? '?'} tokens`)
  return data.choices?.[0]?.message ?? {}
}

// Parses a JSON reply; {} if the model sent something else.
function parseJson(text: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text ?? '')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const stringList = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x && x.length <= maxLen)
    .slice(0, maxItems)

// "milk makes me sick and I can't eat prawns" → known ids ("dairy", "shellfish") + other foods ("kiwi").
async function readAllergies(body: Record<string, unknown>, env: Env) {
  const text = str(body.text, 1000, 'text')
  const allergens = (Array.isArray(body.allergens) ? body.allergens : [])
    .slice(0, 80)
    .map((a) => ({ id: optionalStr(a?.id, 30), label: optionalStr(a?.label, 50) }))
    .filter((a) => /^[a-z-]+$/.test(a.id))
  const prompt = `A user described their food allergies or intolerances. Reply with a JSON object {"known": [...], "other": [...]}.
Count foods, food groups and types of ingredient or additive they react to (e.g. "artificial stuff", "sulfites", "msg", "nightshades").
Put each one in "known" if it matches one of these ids: ${allergens.map((a) => `${a.id} (${a.label})`).join(', ')}.
Put anything else in "other" under its clearest standard name, lowercase, 1-3 words (e.g. "sulfites", not "sulfite things").
Ignore anything that isn't something they react to.

User's description: """${text}"""`
  const reply = parseJson((await groq(env, env.GROQ_TEXT_MODEL, prompt, 'json')).content)
  const ids = new Set(allergens.map((a) => a.id))
  return { known: stringList(reply.known, 40, 30).filter((k) => ids.has(k)), other: stringList(reply.other, 20, 50) }
}

// "chicken soup and toast" → its likely ingredients, for the meal log.
async function guessIngredients(body: Record<string, unknown>, env: Env) {
  const meal = str(body.meal, 1000, 'meal')
  const prompt = `List the ingredients a typical version of this meal would contain, including common hidden ones (butter, oil, flour, milk, sauces).
Reply with a JSON object {"ingredients": [...]}: simple lowercase ingredient names of 1-3 words, at most 25, no amounts.

Meal: """${meal}"""`
  const reply = parseJson((await groq(env, env.GROQ_TEXT_MODEL, prompt, 'json')).content)
  return { ingredients: [...new Set(stringList(reply.ingredients, 25, 60))] }
}

// "nightshades" → the names it goes by on labels and in recipes, plus ones that
// only sometimes contain it. Kept for 30 days per allergy, so everyone typing the
// same allergy gets the same list and it costs one AI call.
async function allergyNames(body: Record<string, unknown>, env: Env) {
  const allergy = str(body.allergy, 50, 'allergy').toLowerCase()
  const cacheKey = new Request(`https://safebite-cache.internal/ai/allergy-names/v2/${encodeURIComponent(allergy)}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached.json()
  const prompt = `Someone is allergic or intolerant to: "${allergy}". It may be a food, a food group, or a type of ingredient or additive (e.g. sulfites, MSG, artificial additives).
Reply with a JSON object {"names": [...], "maybe": [...]}.
"names": ingredient names that mean a food contains it, exactly as they appear on food labels and in recipes: its common forms, names derived from it, and for additives their label names and E-numbers. Include "${allergy}" itself only if it would appear on a label. At most 20.
"maybe": ingredient names that only sometimes contain it (e.g. "natural flavors", "spice blend"). At most 6.
Lowercase, 1-4 words each, no explanations. If it isn't something food can contain, reply {"names": [], "maybe": []}.`
  const reply = parseJson((await groq(env, env.GROQ_TEXT_MODEL, prompt, 'json')).content)
  const names = [...new Set(stringList(reply.names, 20, 40))]
  const result = { names, maybe: stringList(reply.maybe, 6, 40).filter((m) => !names.includes(m)) }
  await caches.default.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Cache-Control': 'max-age=2592000' } }))
  return result
}

// Searches the web for a product's ingredient list. null if it can't find this exact product.
// A web search uses a large share of the daily token allowance, so answers are
// kept per barcode for 7 days and a repeat scan doesn't search again.
async function findProduct(body: Record<string, unknown>, env: Env) {
  const barcode = typeof body.barcode === 'string' ? body.barcode : ''
  if (!/^\d{6,14}$/.test(barcode)) throw new BadRequest('barcode must be 6 to 14 digits')
  const cacheKey = new Request(`https://safebite-cache.internal/ai/product/${barcode}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached.json()
  const result = await searchProduct(barcode, body, env)
  await caches.default.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Cache-Control': 'max-age=604800' } }))
  return result
}

async function searchProduct(barcode: string, body: Record<string, unknown>, env: Env) {
  const name = optionalStr(body.name, 300)
  const brand = optionalStr(body.brand, 200)
  // Most of the tokens are search results the model reads, so ask for one
  // precise search on the barcode lookup sites that list ingredients.
  const query = name ? `${barcode} ${name}${brand ? ` ${brand}` : ''} ingredients` : `${barcode} ingredients`
  const prompt = `Find the ingredient list of the packaged food product with barcode (UPC/EAN) ${barcode}${name ? `, "${name}"${brand ? ` by ${brand}` : ''}` : ''}.
Do exactly ONE web search, with the query: ${query}
Barcode lookup sites such as go-upc.com, barcodelookup.com, barcodespider.com and barcodereport.com often show a product's ingredients; prefer their result for this exact barcode.
Answer from that one search's results. Don't search again or open more pages. Only use a result that is for this exact barcode or product.
Reply in exactly this format and nothing else:
NAME: <product name>
BRAND: <brand, or leave blank>
INGREDIENTS: <the ingredient list, comma separated>
If you can't find this exact product's ingredients, reply only: NOT FOUND`
  const message = await groq(env, env.GROQ_SEARCH_MODEL, prompt, 'search')
  const text = message.content ?? ''
  if (/NOT FOUND/i.test(text)) return { product: null }
  // One "KEY: value" line; tolerates markdown like "**NAME:**".
  const field = (key: string, max: number) =>
    (text.match(new RegExp(`^[ \\t*]*${key}[ \\t*]*:(.*)$`, 'im'))?.[1] ?? '').replace(/^[\s*]+|[\s*]+$/g, '').slice(0, max)
  const ingredientsText = field('INGREDIENTS', 3000)
  if (!ingredientsText) return { product: null }
  const sources = searchResults(message)
    .map((r) => ({ title: (r.title || new URL(r.url).hostname).slice(0, 200), uri: r.url }))
    .slice(0, 5)
  return { product: { name: field('NAME', 300) || name || 'Unknown product', brand: field('BRAND', 200) || brand, ingredientsText, sources } }
}

// The pages a web-searching model actually looked at.
const searchResults = (message: GroqMessage) =>
  (message.executed_tools ?? [])
    .flatMap((t) => t.search_results?.results ?? [])
    .filter((r): r is { title?: string; url: string } => typeof r.url === 'string' && /^https?:\/\//.test(r.url))

// Searches the web for recipes the database lacks, leaving out what the cook
// must avoid. Kept for 7 days per search + allergies, like product searches.
async function findRecipes(body: Record<string, unknown>, env: Env) {
  const query = str(body.query, 100, 'query').toLowerCase()
  const avoid = [...new Set((Array.isArray(body.avoid) ? body.avoid : []).slice(0, 40).map((a) => optionalStr(a, 60).toLowerCase()).filter(Boolean))].sort()

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ query, avoid })))
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const cacheKey = new Request(`https://safebite-cache.internal/ai/recipes/${hash}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached.json()

  const prompt = `Find real recipes for: "${query}".
Do exactly ONE web search, with the query: ${query} recipe${avoid.length ? ` without ${avoid.join(' ')}` : ''}
Answer from that one search's results. Don't search again or open more pages.
Give up to 5 different recipes.${avoid.length ? ` Skip any recipe that contains or is usually made with: ${avoid.join(', ')}.` : ''}
Reply with only a JSON object and nothing else:
{"recipes": [{"name": "<recipe name>", "category": "<e.g. Dessert, or empty>", "area": "<cuisine, or empty>", "url": "<the page it came from>", "ingredients": [{"name": "<ingredient only>", "measure": "<amount, or empty>"}], "instructions": "<the steps, one per line, at most 8 short lines>"}]}
If nothing fits, reply {"recipes": []}.`
  const message = await groq(env, env.GROQ_SEARCH_MODEL, prompt, 'search', 4000)
  // Search mode can't force JSON, so the object may come wrapped in other text.
  const text = message.content ?? ''
  const reply = parseJson(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  // A cut-off or garbled reply isn't an answer: fail, and don't keep it for 7 days.
  if (!Array.isArray(reply.recipes)) throw new Error('The recipe search sent an unreadable reply')

  // Only link pages the search really returned, not URLs the model may have made up.
  const pages = new Set(searchResults(message).map((r) => r.url))
  const recipes = reply.recipes.slice(0, 5).flatMap((r: Record<string, unknown>) => {
    const name = optionalStr(r?.name, 200)
    const instructions = optionalStr(r?.instructions, 5000)
    const ingredients = (Array.isArray(r?.ingredients) ? r.ingredients : [])
      .slice(0, 50)
      .map((i) => ({ name: optionalStr(i?.name, 120), measure: optionalStr(i?.measure, 60) }))
      .filter((i) => i.name)
    if (!name || !instructions || !ingredients.length) return []
    const url = optionalStr(r?.url, 500)
    return [{ name, category: optionalStr(r?.category, 60), area: optionalStr(r?.area, 60), url: pages.has(url) ? url : '', ingredients, instructions }]
  })
  const result = { recipes: [...new Map(recipes.map((r) => [r.name.toLowerCase(), r])).values()] }
  await caches.default.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Cache-Control': 'max-age=604800' } }))
  return result
}

// For each ingredient someone can't eat in a recipe: can it be left out, and
// what to use instead. Kept for 30 days per recipe + ingredients + allergies,
// so the next person with the same allergies doesn't use another AI call.
async function recipeSwaps(body: Record<string, unknown>, env: Env) {
  const recipe = str(body.recipe, 200, 'recipe')
  const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : []).slice(0, 40).map((i) => optionalStr(i, 120)).filter(Boolean)
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 20)
    .map((i) => ({ ingredient: optionalStr(i?.ingredient, 120), reason: optionalStr(i?.reason, 120) }))
    .filter((i) => i.ingredient)
  const avoid = (Array.isArray(body.avoid) ? body.avoid : []).slice(0, 40).map((a) => optionalStr(a, 60)).filter(Boolean)
  if (!items.length) throw new BadRequest('items must list at least one ingredient')

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ recipe, ingredients, items, avoid })))
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const cacheKey = new Request(`https://safebite-cache.internal/ai/swaps/${hash}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached.json()

  const prompt = `Recipe: "${recipe}". Its ingredients: ${ingredients.join(', ')}.
The cook must avoid: ${avoid.join(', ') || 'the ingredients listed below'}.
For each ingredient below, say whether it can simply be left out without ruining the dish (a garnish, topping, or small optional amount), and the best common replacement that contains none of the avoided things. If nothing works, leave "replacement" empty.
${items.map((i, n) => `${n + 1}. ${i.ingredient}${i.reason ? ` (${i.reason})` : ''}`).join('\n')}
Reply with a JSON object {"swaps": [{"ingredient": "<exactly as written above>", "canOmit": true or false, "replacement": "<a few words, or empty>", "note": "<at most 15 words: amount or how to use it, or empty>"}]}.`
  const reply = parseJson((await groq(env, env.GROQ_TEXT_MODEL, prompt, 'json')).content)
  const wanted = new Map(items.map((i) => [i.ingredient.toLowerCase(), i.ingredient]))
  const swaps = (Array.isArray(reply.swaps) ? reply.swaps : []).flatMap((s: Record<string, unknown>) => {
    const ingredient = wanted.get(optionalStr(s?.ingredient, 120).toLowerCase())
    if (!ingredient) return []
    return [{ ingredient, canOmit: s?.canOmit === true, replacement: optionalStr(s?.replacement, 80), note: optionalStr(s?.note, 150) }]
  })
  const result = { swaps }
  await caches.default.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Cache-Control': 'max-age=2592000' } }))
  return result
}

const AI_ROUTES: Record<string, (body: Record<string, unknown>, env: Env) => Promise<unknown>> = {
  '/ai/swaps': recipeSwaps,
  '/ai/allergies': readAllergies,
  '/ai/ingredients': guessIngredients,
  '/ai/product': findProduct,
  '/ai/recipes': findRecipes,
  '/ai/allergy-names': allergyNames,
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin') ?? '', env)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
      })
    }
    const url = new URL(request.url)

    // Each visitor (by IP) gets a limited number of requests a minute, so nobody can drain the free quotas.
    const { success } = await env.LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    if (!success) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429, cors)

    try {
      if (url.pathname === '/usda' && request.method === 'GET') {
        const barcode = url.searchParams.get('barcode') ?? ''
        if (!/^\d{6,14}$/.test(barcode)) throw new BadRequest('barcode must be 6 to 14 digits')
        if (!env.USDA_API_KEY) return json({ error: 'USDA_API_KEY is not set on the worker' }, 500, cors)
        return json({ product: await lookupUsda(barcode, env) }, 200, cors)
      }
      const aiRoute = AI_ROUTES[url.pathname]
      if (aiRoute && request.method === 'POST') {
        if (!env.GROQ_API_KEY) return json({ error: 'GROQ_API_KEY is not set on the worker' }, 500, cors)
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
        if (!body || typeof body !== 'object') throw new BadRequest('Send a JSON body')
        return json(await aiRoute(body, env), 200, cors)
      }
      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      if (err instanceof BadRequest) return json({ error: err.message }, 400, cors)
      if (err instanceof AiLimitReached) return json({ error: err.message }, 429, cors)
      console.error(err)
      return json({ error: 'The lookup failed. Try again in a moment.' }, 502, cors)
    }
  },
}
