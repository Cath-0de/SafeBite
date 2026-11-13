// Keeps the allergy bank free of repeats, so the profile doesn't list one thing twice.
// Run from safebite/: node --experimental-strip-types --test "test/*.mjs"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ALLERGY_BANK, SPELLINGS } from '../src/lib/allergyBank.ts'

const namesOf = (allergy) => allergy.groups.flatMap((g) => g.names.map((name) => ({ name, maybe: Boolean(g.maybe) })))
const allNames = new Set(ALLERGY_BANK.flatMap((a) => namesOf(a).map((n) => n.name)))
// Different foods that happen to share a word, kept so each can be unticked by itself.
const DIFFERENT_FOODS = new Set(['buttermilk', 'ice cream', 'cream cheese', 'eggnog', 'hamburger', 'monosodium glutamate'])

test('an allergy never lists the same name twice', () => {
  for (const a of ALLERGY_BANK) {
    const names = namesOf(a).map((n) => n.name)
    assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], a.id)
  }
})

test('other spellings are only in SPELLINGS, and the shown one is in the bank', () => {
  for (const [shown, ...others] of SPELLINGS) {
    assert.ok(allNames.has(shown), `${shown} is not in the bank`)
    for (const other of others) assert.ok(!allNames.has(other), `${other} should be under ${shown}`)
  }
})

test('nothing is listed that another name in the allergy already catches', () => {
  const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const a of ALLERGY_BANK) {
    const names = namesOf(a)
    for (const x of names) {
      if (DIFFERENT_FOODS.has(x.name)) continue
      // A "maybe" name doesn't cover a definite one: the warning would be weaker.
      const by = names.filter((y) => y.name !== x.name && (!y.maybe || x.maybe) && new RegExp(`\\b${escape(y.name)}`, 'i').test(x.name))
      assert.deepEqual(by.map((y) => y.name), [], `${a.id}: "${x.name}" is already caught`)
    }
  }
})
