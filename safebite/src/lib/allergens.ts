// The fixed allergen vocabulary. profiles/{uid}.allergens stores these ids, and
// rules/{ruleId}.matchesAllergenTags should use the same ids.
export const ALLERGENS = [
  { id: 'dairy', label: 'Dairy' },
  { id: 'egg', label: 'Eggs' },
  { id: 'gluten', label: 'Gluten / wheat' },
  { id: 'peanut', label: 'Peanuts' },
  { id: 'tree-nut', label: 'Tree nuts' },
  { id: 'soy', label: 'Soy' },
  { id: 'fish', label: 'Fish' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'sesame', label: 'Sesame' },
] as const
