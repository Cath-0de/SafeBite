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

export const searchMeals = (query: string) =>
  fetchMeals(`search.php?s=${encodeURIComponent(query)}`)

export const randomMeal = async () => (await fetchMeals('random.php'))[0]
