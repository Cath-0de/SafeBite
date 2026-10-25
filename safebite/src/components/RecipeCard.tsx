// One recipe card (search results and the home page rows). If the recipe has
// any of the user's allergens, it shows a warning naming them and highlights
// those ingredients in the list. Recipes users wrote have no photo and get a
// "Not verified" tag.
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { Meal } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { allergenRegex, allergensIn } from '../lib/allergens'
import Icon from './Icon'
import UnverifiedTag from './UnverifiedTag'

export default function RecipeCard({ meal }: { meal: Meal }) {
  const { user, profile } = useAuth()
  const myAllergens = profile?.allergens ?? []
  const names = meal.ingredients.map((i) => i.name)
  const found = allergensIn(myAllergens, names)
  const re = allergenRegex(myAllergens)

  return (
    <Link to={`/recipes/${meal.id}`} className="card">
      {meal.thumbnail ? (
        <img src={meal.thumbnail} alt="" loading="lazy" />
      ) : (
        <div className="card-placeholder"><Icon name="recipes" size={40} /></div>
      )}
      {meal.userRecipe && <UnverifiedTag mine={meal.userRecipe.ownerId === user?.uid} />}
      <h2>{meal.name}</h2>
      {found.length > 0 && (
        <p className="allergy-flags">
          <span role="img" aria-label="Warning">⚠️</span>
          {found.map((a) => <span key={a} className="allergy-chip">{a}</span>)}
        </p>
      )}
      <p className="muted">{[meal.category, meal.area].filter(Boolean).join(' · ')}</p>
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
