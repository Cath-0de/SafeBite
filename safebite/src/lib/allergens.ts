// The fixed allergen vocabulary. profiles/{uid}.allergens stores these ids, and
// rules/{ruleId}.matchesAllergenTags should use the same ids.
// `id` is what gets stored; `label` is what the profile form shows.
// `words` are what the allergen looks like in ingredient lists and Open Food
// Facts tags; each matches at a word start, so "egg" also matches "eggs".
export const ALLERGENS = [
  { id: 'dairy', label: 'Dairy', words: ['milk', 'dairy', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'yogurt', 'yoghurt'] },
  { id: 'egg', label: 'Eggs', words: ['egg', 'albumin'] },
  { id: 'gluten', label: 'Gluten / wheat', words: ['gluten', 'wheat', 'barley', 'rye', 'malt', 'spelt'] },
  { id: 'peanut', label: 'Peanuts', words: ['peanut'] },
  { id: 'tree-nut', label: 'Tree nuts', words: ['nuts', 'almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'pistachio', 'macadamia'] },
  { id: 'soy', label: 'Soy', words: ['soy'] },
  { id: 'fish', label: 'Fish', words: ['fish', 'anchov', 'salmon', 'tuna', 'cod'] },
  { id: 'shellfish', label: 'Shellfish', words: ['shellfish', 'crustacean', 'mollus', 'shrimp', 'prawn', 'crab', 'lobster'] },
  { id: 'sesame', label: 'Sesame', words: ['sesame'] },
  // dextrose and maltodextrin are usually corn-derived in the US
  { id: 'corn', label: 'Corn', words: ['corn', 'popcorn', 'sweetcorn', 'maize', 'polenta', 'grits', 'hominy', 'masa', 'dextrose', 'maltodextrin'] },
] as const

// profiles/{uid}.allergens can also hold allergies the user typed in themselves
// ("kiwi"). Those aren't ids above, so the typed text is the word to look for.
const known = (id: string) => ALLERGENS.find((a) => a.id === id)
const wordsFor = (id: string): readonly string[] => known(id)?.words ?? [id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')]
const regexFor = (words: readonly string[]) => new RegExp(`\\b(?:${words.join('|')})`, 'i')

// What to show the user for an allergen id: its label, or the typed text itself.
export const allergenLabel = (id: string) => known(id)?.label ?? id

// One case-insensitive regex for the given allergen ids, or null if none.
// shortcut: plain word matching flags look-alikes ("cocoa butter", "eggplant"); use rules/ in Firestore when it is filled.
export function allergenRegex(ids: string[]): RegExp | null {
  const words = ids.flatMap(wordsFor)
  return words.length ? regexFor(words) : null
}

// The labels of the user's allergens that appear in any of the texts (e.g. a recipe's ingredient names).
export function allergensIn(ids: string[], texts: string[]): string[] {
  return ids.filter((id) => texts.some((t) => regexFor(wordsFor(id)).test(t))).map(allergenLabel)
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
export function substituteFor(ids: string[], ingredient: string): string | null {
  const swap = SWAPS.find(
    (s) => ids.includes(s.allergen) && regexFor(s.words).test(ingredient) && !allergenRegex(ids.filter((id) => id !== s.allergen))?.test(s.use),
  )
  return swap?.use ?? null
}
