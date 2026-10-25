// One recipe card (search results and the home page rows). If the recipe has
// any of the user's allergens, it shows a warning naming them and highlights
// those ingredients in the list.
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { Meal } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { allergenRegex, allergensIn } from '../lib/allergens'

export default function RecipeCard({ meal }: { meal: Meal }) {
  const { profile } = useAuth()
  const myAllergens = profile?.allergens ?? []
  const names = meal.ingredients.map((i) => i.name)
  const found = allergensIn(myAllergens, names)
  const re = allergenRegex(myAllergens)

  return (
    <Link to={`/recipes/${meal.id}`} className="card">
      <img src={meal.thumbnail} alt="" loading="lazy" />
      <h2>{meal.name}</h2>
      {found.length > 0 && (
        <p className="allergy-flags">
          <span role="img" aria-label="Warning">⚠️</span>
          {found.map((a) => <span key={a} className="allergy-chip">{a}</span>)}
        </p>
      )}
      <p className="muted">{meal.category} · {meal.area}</p>
      <p className="ingredients">
        {names.map((n, i) => (
          <Fragment key={i}>
            {i > 0 && ', '}
            {re?.test(n) ? <mark>{n}</mark> : n}
          </Fragment>
        ))}
      </p>
    </Link>
  )
}
