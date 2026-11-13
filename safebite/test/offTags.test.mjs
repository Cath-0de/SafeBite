// Open Food Facts' allergen and "may contain" tags must match the right allergy,
// or Scan won't flag them.
// Run from safebite/: node --experimental-strip-types --test "test/*.mjs"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allergensIn, allergenLabel } from '../src/lib/allergens.ts'

// The 14 EU allergen tags Open Food Facts uses (allergens_tags / traces_tags, "en:" stripped).
const TAGS = {
  milk: 'dairy', eggs: 'egg', gluten: 'gluten', peanuts: 'peanut', nuts: 'tree-nut',
  soybeans: 'soy', fish: 'fish', crustaceans: 'shellfish', molluscs: 'shellfish',
  'sesame-seeds': 'sesame', celery: 'celery', mustard: 'mustard', lupin: 'lupin',
  'sulphur-dioxide-and-sulphites': 'sulfites',
}

test('each Open Food Facts allergen tag flags its allergy', () => {
  const missed = Object.entries(TAGS).filter(([tag, id]) => !allergensIn({ allergens: [id] }, [tag]).includes(allergenLabel(id)))
  assert.deepEqual(missed, [])
})

// Names Open Food Facts detects these allergens by (taxonomies/allergens.txt) that the bank once missed.
test('names from the Open Food Facts taxonomy are caught', () => {
  for (const [name, id] of [['turbot', 'fish'], ['sole', 'fish'], ['soja', 'soy'], ['soia', 'soy'], ['treenuts', 'tree-nut'], ['scallop', 'shellfish'], ['matsutake', 'mushrooms']]) {
    assert.deepEqual(allergensIn({ allergens: [id] }, [name]), [allergenLabel(id)], name)
  }
})
