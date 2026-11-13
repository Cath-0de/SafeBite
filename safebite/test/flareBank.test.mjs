// The flare foods: only checked during a UC flare-up, and not tripped by look-alike words.
// Run from safebite/: node --experimental-strip-types --test "test/*.mjs"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allergensIn, allergiesOf, maybeAllergensIn } from '../src/lib/allergens.ts'
import { FLARE_BANK } from '../src/lib/flareBank.ts'

const profile = (extra) => ({ allergens: ['egg'], ...extra })
const flare = allergiesOf(profile({ currentState: 'flare' }))

test('flare foods count only for UC users in a flare-up', () => {
  assert.equal(flare.allergens.length, 1 + FLARE_BANK.length)
  assert.deepEqual(allergiesOf(profile({ currentState: 'remission' })).allergens, ['egg'])
  assert.deepEqual(allergiesOf(profile({ currentState: 'flare', hasUC: false })).allergens, ['egg'])
  assert.equal(allergiesOf(null).allergens.length, 0)
})

test('a flare food never lists the same name twice', () => {
  for (const f of FLARE_BANK) {
    const names = f.groups.flatMap((g) => g.names)
    assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], f.id)
  }
})

test('flare-unfriendly ingredients are flagged, and the label says flare', () => {
  assert.deepEqual(allergensIn(flare, ['brown rice']), ['High-fibre grains (flare)'])
  assert.deepEqual(allergensIn(flare, ['2 tbsp sriracha']), ['Spicy food (flare)'])
  assert.deepEqual(maybeAllergensIn(flare, ['red lentils']), ['Beans & lentils (flare)'])
})

test('look-alike words are not flagged as flare foods', () => {
  for (const safe of ['baking soda', 'chocolate chips', 'cherry tomatoes', 'stir-fried chicken', 'white rice', 'grapefruit juice']) {
    assert.deepEqual(allergensIn(flare, [safe]).filter((l) => l.endsWith('(flare)')), [], safe)
  }
  assert.ok(!allergensIn(flare, ['brandy']).includes('High-fibre grains (flare)'))
})
