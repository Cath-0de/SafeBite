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

// One case-insensitive regex for the given allergen ids, or null if none.
// shortcut: plain word matching flags look-alikes ("cocoa butter", "eggplant"); use rules/ in Firestore when it is filled.
export function allergenRegex(ids: string[]): RegExp | null {
  const words = ALLERGENS.filter((a) => ids.includes(a.id)).flatMap((a) => a.words)
  return words.length ? new RegExp(`\\b(?:${words.join('|')})`, 'i') : null
}
