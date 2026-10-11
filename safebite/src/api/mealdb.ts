const BASE = 'https://www.themealdb.com/api/json/v1/1'

export interface Meal {
  id: string
  name: string
  category: string
  area: string
  thumbnail: string
  instructions: string
  ingredients: { name: string; measure: string }[]
}

interface RawMeal {
  idMeal: string
  strMeal: string
  strCategory: string
  strArea: string
  strMealThumb: string
  strInstructions: string
  [key: string]: string | null
}

function toMeal(raw: RawMeal): Meal {
  const ingredients: Meal['ingredients'] = []
  for (let i = 1; i <= 20; i++) {
    const name = raw[`strIngredient${i}`]?.trim()
    if (name) ingredients.push({ name, measure: raw[`strMeasure${i}`]?.trim() ?? '' })
  }
  return {
    id: raw.idMeal,
    name: raw.strMeal,
    category: raw.strCategory,
    area: raw.strArea,
    thumbnail: raw.strMealThumb,
    instructions: raw.strInstructions,
    ingredients,
  }
}

async function fetchMeals(path: string): Promise<Meal[]> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`TheMealDB request failed (${res.status})`)
  const data: { meals: RawMeal[] | null } = await res.json()
  return (data.meals ?? []).map(toMeal)
}

// filter.php returns only id, name and thumbnail, so callers look up the full recipe by id.
async function fetchMealIds(path: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`TheMealDB request failed (${res.status})`)
  const data: { meals: { idMeal: string }[] | null } = await res.json()
  return (data.meals ?? []).map((m) => m.idMeal)
}

// Each category/ingredient match costs one lookup request, so cap how many we add.
const MAX_EXTRA_MATCHES = 12

// search.php only matches recipe names (so "pasta" finds a single recipe), so
// also include recipes whose category or main ingredient matches the query.
export async function searchMeals(query: string): Promise<Meal[]> {
  const q = encodeURIComponent(query)
  const ingredient = encodeURIComponent(query.replace(/\s+/g, '_'))
  const [byName, byCategory, byIngredient] = await Promise.all([
    fetchMeals(`search.php?s=${q}`),
    fetchMealIds(`filter.php?c=${q}`),
    fetchMealIds(`filter.php?i=${ingredient}`),
  ])
  const found = new Set(byName.map((m) => m.id))
  const extraIds = [...new Set([...byCategory, ...byIngredient])]
    .filter((id) => !found.has(id))
    .slice(0, MAX_EXTRA_MATCHES)
  const extras = await Promise.all(extraIds.map((id) => fetchMeals(`lookup.php?i=${id}`)))
  return [...byName, ...extras.flat()]
}

// An empty name search returns the API's default page of recipes.
export const browseMeals = () => fetchMeals('search.php?s=')

export const randomMeal = async () => (await fetchMeals('random.php'))[0]
