// How the recipe search reads what people type.
// Run from safebite/: node --experimental-strip-types --test "test/*.mjs"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closestName, parseExclusions, parseTerms } from '../src/api/mealdb.ts'

test('what to leave out never becomes something to search for', () => {
  for (const [query, terms, out] of [
    ['pasta without cheese', ['pasta'], ['cheese']],
    ['pasta without cheese and nuts', ['pasta'], ['cheese', 'nuts']],
    ['no nuts', [], ['nuts']],
    ['dairy free', [], ['dairy']],
    ['dairy-free pasta', ['pasta'], ['dairy']],
    ['gluten free chicken and rice', ['chicken', 'rice'], ['gluten']],
    ['chicken without garlic with rice', ['chicken', 'rice'], ['garlic']],
    ['no bake cookies', ['no bake cookies'], []],
  ]) {
    assert.deepEqual(parseTerms(query), terms, query)
    assert.deepEqual(parseExclusions(query), out, query)
  }
})

test('filler words are dropped, real names are left alone', () => {
  assert.deepEqual(parseTerms('a recipe for chicken'), ['chicken'])
  assert.deepEqual(parseTerms('how to make lasagne'), ['lasagne'])
  assert.deepEqual(parseTerms('steak and pasta'), ['steak', 'pasta'])
  assert.deepEqual(parseTerms('mac and cheese'), ['mac', 'cheese'])
})

test('typos find the closest name, unless the word is too short or too far off', () => {
  const names = ['Chicken', 'Beef', 'Broccoli', 'Rice', 'Ice Cream']
  assert.equal(closestName('chiken', names), 'chicken')
  assert.equal(closestName('chikcen', names), 'chicken')
  assert.equal(closestName('brocoli', names), 'broccoli')
  assert.equal(closestName('beaf', names), 'beef')
  assert.equal(closestName('ice', names), null)
  assert.equal(closestName('zebra', names), null)
})
