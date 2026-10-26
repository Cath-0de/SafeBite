// SafeBite's API (Cloudflare Worker). The app calls these routes instead of
// calling services with secret keys directly:
//   GET  /usda?barcode=<digits>  →  { product: { name, brand, ingredientsText } | null }
//   POST /ai/allergies    { text, allergens: [{ id, label }] }  →  { known: string[], other: string[] }
//   POST /ai/ingredients  { meal }                              →  { ingredients: string[] }
//   POST /ai/product      { barcode, name?, brand? }            →  { product: { name, brand, ingredientsText, sources } | null }
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
async function groq(env: Env, model: string, prompt: string, mode: 'json' | 'search'): Promise<GroqMessage> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      // Keep each request small: the free tier has a daily token allowance per model.
      reasoning_effort: 'low',
      max_completion_tokens: 1024,
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
    .slice(0, 30)
    .map((a) => ({ id: optionalStr(a?.id, 30), label: optionalStr(a?.label, 50) }))
    .filter((a) => /^[a-z-]+$/.test(a.id))
  const prompt = `A user described their food allergies or intolerances. Reply with a JSON object {"known": [...], "other": [...]}.
Put each food they react to in "known" if it matches one of these ids: ${allergens.map((a) => `${a.id} (${a.label})`).join(', ')}.
Put anything else in "other" as a short lowercase food name (1-3 words). Ignore anything that isn't a food they react to.

User's description: """${text}"""`
  const reply = parseJson((await groq(env, env.GROQ_TEXT_MODEL, prompt, 'json')).content)
  const ids = new Set(allergens.map((a) => a.id))
  return { known: stringList(reply.known, 30, 30).filter((k) => ids.has(k)), other: stringList(reply.other, 20, 50) }
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
  const sources = (message.executed_tools ?? [])
    .flatMap((t) => t.search_results?.results ?? [])
    .filter((r): r is { title?: string; url: string } => typeof r.url === 'string' && /^https?:\/\//.test(r.url))
    .map((r) => ({ title: (r.title || new URL(r.url).hostname).slice(0, 200), uri: r.url }))
    .slice(0, 5)
  return { product: { name: field('NAME', 300) || name || 'Unknown product', brand: field('BRAND', 200) || brand, ingredientsText, sources } }
}

const AI_ROUTES: Record<string, (body: Record<string, unknown>, env: Env) => Promise<unknown>> = {
  '/ai/allergies': readAllergies,
  '/ai/ingredients': guessIngredients,
  '/ai/product': findProduct,
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
