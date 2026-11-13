// Matching the user's allergies against ingredient text. The allergies and
// the names each goes by live in allergyBank.ts; profiles/{uid}.allergens
// stores their ids, plus any allergies the user typed in themselves.
// rules/{ruleId}.matchesAllergenTags should use the same ids.
import { ALLERGY_BANK, SPELLINGS, type AllergyGroup } from './allergyBank'

export const ALLERGENS = ALLERGY_BANK

// What a profile says about its allergies. Profile has these fields, so pass the profile itself.
export type Allergies = { allergens: string[]; allergyDetails?: AllergyDetails }
// Per allergy id: for typed-in allergies, the names the AI suggested (`names`,
// `maybe`); for any allergy, names the user added (`extra`) and unticked (`off`).
export type AllergyDetails = Record<string, { names?: string[]; maybe?: string[]; extra?: string[]; off?: string[] }>
export const NO_ALLERGIES: Allergies = { allergens: [] }

const known = (id: string) => ALLERGENS.find((a) => a.id === id)
const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Every spelling of a name, from any one of them.
const spellingsOf = new Map(SPELLINGS.flatMap((all) => all.map((word) => [word, all] as const)))
const regexFor = (words: readonly string[]) =>
  words.length ? new RegExp(`\\b(?:${words.flatMap((w) => spellingsOf.get(w) ?? [w]).map(escape).join('|')})`, 'i') : null

// AI lists often repeat themselves ("tomato", "tomatoes", "yoghurt", "yogurt"):
// one spelling of each, and nothing another name already catches.
function withoutRepeats(names: readonly string[]) {
  const unique = [...new Set(names.map((n) => spellingsOf.get(n)?.[0] ?? n))]
  return unique.filter((n) => !unique.some((other) => other !== n && regexFor([other])?.test(n)))
}

// The groups of names the profile form shows for one allergy, ticked or not:
// the bank's groups (or, for a typed-in allergy, the AI's names or just the
// typed word), plus a group of names the user added.
export function groupsFor(id: string, details?: AllergyDetails): AllergyGroup[] {
  const d = details?.[id]
  const groups: AllergyGroup[] = known(id)?.groups.slice() ?? [
    { label: allergenLabel(id), names: withoutRepeats(d?.names?.length ? d.names : [id]) },
    ...(d?.maybe?.length ? [{ label: 'Sometimes contains it', names: withoutRepeats(d.maybe), maybe: true }] : []),
  ]
  const listed = new Set(groups.flatMap((g) => g.names))
  const extra = (d?.extra ?? []).filter((n) => !listed.has(n))
  return extra.length ? [...groups, { label: 'Added by you', names: extra }] : groups
}

// Every name for one allergy, split into definite and "sometimes contains".
export function allNamesFor(id: string, details?: AllergyDetails): { names: string[]; maybe: string[] } {
  const groups = groupsFor(id, details)
  const pick = (maybe: boolean) => [...new Set(groups.filter((g) => Boolean(g.maybe) === maybe).flatMap((g) => g.names))]
  return { names: pick(false), maybe: pick(true) }
}

// The names to look for for one allergy: all of them minus what the user unticked.
function activeNames(id: string, details?: AllergyDetails) {
  const { names, maybe } = allNamesFor(id, details)
  const off = new Set(details?.[id]?.off ?? [])
  return { names: names.filter((n) => !off.has(n)), maybe: maybe.filter((n) => !off.has(n)) }
}

// What to show the user for an allergen id: its label, or the typed text itself.
export const allergenLabel = (id: string) => known(id)?.label ?? id

// One case-insensitive regex for all of the user's allergies, or null if none.
// kind 'maybe' matches the "sometimes contains" names instead.
// shortcut: plain word matching flags look-alikes ("cocoa butter", "eggplant"); use rules/ in Firestore when it is filled.
export function allergenRegex(a: Allergies, kind: 'names' | 'maybe' = 'names'): RegExp | null {
  return regexFor(a.allergens.flatMap((id) => activeNames(id, a.allergyDetails)[kind]))
}

// The labels of the user's allergens that appear in any of the texts (e.g. a recipe's ingredient names).
export function allergensIn(a: Allergies, texts: string[]): string[] {
  return a.allergens
    .filter((id) => texts.some((t) => regexFor(activeNames(id, a.allergyDetails).names)?.test(t)))
    .map(allergenLabel)
}

// The labels of the user's allergens that only a "maybe" name matches (e.g. "natural flavors" for dairy).
export function maybeAllergensIn(a: Allergies, texts: string[]): string[] {
  const definite = new Set(allergensIn(a, texts))
  return a.allergens
    .filter((id) => texts.some((t) => regexFor(activeNames(id, a.allergyDetails).maybe)?.test(t)))
    .map(allergenLabel)
    .filter((label) => !definite.has(label))
}

// Words people use for a whole allergy that aren't its id.
const ALLERGY_WORDS: Record<string, string[]> = {
  milk: ['dairy'],
  wheat: ['gluten'],
  nut: ['tree-nut', 'peanut'],
  meat: ['red-meat', 'poultry'],
  mushroom: ['mushrooms'],
}

// What a search's "without X" means, to check recipes with allergensIn: X's whole
// allergy if it names one ("dairy" also rules out butter), the names of its group
// in the bank if it names one ("cheese" also rules out parmesan), and always X itself.
export function exclusionsToAllergies(words: string[]): Allergies {
  const singular = (w: string) => w.replace(/e?s$/, '')
  const groups = ALLERGENS.flatMap((a) => a.groups).filter((g) => !g.maybe)
  const allergyDetails: AllergyDetails = {}
  const ids = words.flatMap((w) => {
    const word = singular(w)
    const group = groups.find((g) => [w, word].includes(g.label.toLowerCase()))
    if (group) allergyDetails[word] = { names: [word, ...group.names] }
    return [word, ...(known(w) ? [w] : []), ...(ALLERGY_WORDS[word] ?? [])]
  })
  return { allergens: [...new Set(ids)], allergyDetails }
}

// Swaps offered for flagged ingredients. Most specific first: the first entry
// for one of the user's allergies whose words match the ingredient wins.
// shortcut: hand-picked starter list; read rules/{ruleId}.safeSubstitutes instead once that collection is filled.
const SWAPS: { allergen: string; words: string[]; use: string }[] = [
  { allergen: 'peanut', words: ['peanut butter'], use: 'sunflower seed butter' },
  { allergen: 'peanut', words: ['peanut'], use: 'sunflower seeds' },
  { allergen: 'tree-nut', words: ['almond milk'], use: 'oat milk' },
  { allergen: 'tree-nut', words: ['nuts', 'almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'pistachio', 'macadamia'], use: 'sunflower or pumpkin seeds' },
  { allergen: 'dairy', words: ['cream cheese'], use: 'dairy-free cream cheese' },
  { allergen: 'dairy', words: ['butter'], use: 'olive oil or dairy-free butter' },
  { allergen: 'dairy', words: ['cream'], use: 'coconut cream' },
  { allergen: 'dairy', words: ['cheese'], use: 'dairy-free cheese' },
  { allergen: 'dairy', words: ['milk'], use: 'oat milk' },
  { allergen: 'dairy', words: ['yogurt', 'yoghurt'], use: 'coconut yogurt' },
  { allergen: 'egg', words: ['egg'], use: 'flax egg (1 tbsp ground flaxseed + 3 tbsp water per egg)' },
  { allergen: 'gluten', words: ['malt vinegar'], use: 'cider vinegar' },
  { allergen: 'gluten', words: ['barley'], use: 'brown rice' },
  { allergen: 'gluten', words: ['wheat', 'spelt', 'rye'], use: 'a gluten-free version' },
  { allergen: 'soy', words: ['soy sauce'], use: 'coconut aminos' },
  { allergen: 'fish', words: ['fish sauce'], use: 'coconut aminos' },
  { allergen: 'fish', words: ['anchov'], use: 'capers or olives' },
  { allergen: 'fish', words: ['fish', 'salmon', 'tuna', 'cod'], use: 'chicken or chickpeas' },
  { allergen: 'shellfish', words: ['shrimp', 'prawn', 'crab', 'lobster'], use: 'chicken or white fish' },
  { allergen: 'sesame', words: ['sesame oil'], use: 'olive oil' },
  { allergen: 'sesame', words: ['sesame'], use: 'sunflower seeds' },
  { allergen: 'corn', words: ['cornflour', 'cornstarch', 'corn starch'], use: 'arrowroot or potato starch' },
  { allergen: 'corn', words: ['sweetcorn', 'corn'], use: 'peas' },
]

// What to use instead of one ingredient, or null if there's no swap for it.
// Skips swaps that match another of the user's allergies ("chicken or white fish" for someone allergic to fish).
export function substituteFor(a: Allergies, ingredient: string): string | null {
  const swap = SWAPS.find(
    (s) =>
      a.allergens.includes(s.allergen) &&
      regexFor(s.words)?.test(ingredient) &&
      !allergenRegex({ ...a, allergens: a.allergens.filter((id) => id !== s.allergen) })?.test(s.use),
  )
  return swap?.use ?? null
}
