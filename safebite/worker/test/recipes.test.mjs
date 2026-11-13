// /ai/recipes with Groq faked. Run from worker/: node --experimental-strip-types --test "test/*.mjs"
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import worker from '../src/index.ts'

const env = { GROQ_API_KEY: 'x', GROQ_SEARCH_MODEL: 'm', ALLOWED_ORIGINS: '', LIMITER: { limit: async () => ({ success: true }) } }
const realPage = 'https://example.com/stew'
let groqCalls, reply, store

beforeEach(() => {
  groqCalls = 0
  store = new Map()
  globalThis.caches = {
    default: {
      match: async (req) => store.get(req.url)?.clone(),
      put: async (req, res) => void store.set(req.url, res),
    },
  }
  globalThis.fetch = async () => {
    groqCalls++
    return Response.json({
      choices: [{ message: { content: reply, executed_tools: [{ search_results: { results: [{ url: realPage }] } }] } }],
    })
  }
})

const search = (body) =>
  worker.fetch(new Request('https://w/ai/recipes', { method: 'POST', body: JSON.stringify(body) }), env)
const stew = { name: 'Stew', category: 'Dinner', area: '', url: realPage, ingredients: [{ name: 'beef', measure: '1 lb' }], instructions: 'Cook.' }

test('reads JSON wrapped in other text, drops bad and repeated recipes and made-up links', async () => {
  reply = 'Here you go:\n```json\n' + JSON.stringify({
    recipes: [
      stew,
      { ...stew, name: 'STEW' },
      { ...stew, name: 'Fake link', url: 'https://made.up/x' },
      { ...stew, name: 'No ingredients', ingredients: [] },
      { ...stew, name: 'No steps', instructions: '' },
      'nonsense',
    ],
  }) + '\n```'
  const { recipes } = await (await search({ query: 'stew', avoid: ['Dairy'] })).json()
  assert.deepEqual(recipes.map((r) => [r.name, r.url]), [['STEW', realPage], ['Fake link', '']])
})

test('repeat search is served from the cache, whatever order the allergies come in', async () => {
  reply = JSON.stringify({ recipes: [stew] })
  await search({ query: 'stew', avoid: ['Egg', 'Dairy'] })
  await search({ query: 'STEW', avoid: ['dairy', 'egg'] })
  assert.equal(groqCalls, 1)
  await search({ query: 'stew', avoid: ['egg'] })
  assert.equal(groqCalls, 2)
})

test('a cut-off reply fails and is not cached', async () => {
  reply = '{"recipes": [{"name": "Ste'
  assert.equal((await search({ query: 'stew' })).status, 502)
  assert.equal(store.size, 0)
})

test('rejects a missing query', async () => {
  assert.equal((await search({})).status, 400)
  assert.equal(groqCalls, 0)
})
