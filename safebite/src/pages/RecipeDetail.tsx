// One recipe's page (route "/recipes/:id"): picture, ingredients with amounts,
// and the full instructions. The recipe is looked up by the id in the URL, so
// the page also works when refreshed or opened from a shared link.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getMeal, type Meal } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { markRecipeViewed } from '../lib/db'
import SaveButton from '../components/SaveButton'

export default function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // The last lookup's outcome, tagged with the id it was for. meal is null if
  // no recipe has that id.
  const [loaded, setLoaded] = useState<{ id: string; meal: Meal | null; error: string } | null>(null)
  // Still loading while what's loaded belongs to a different id.
  const current = loaded?.id === id ? loaded : null

  // Fetch the recipe whenever the id in the URL changes.
  useEffect(() => {
    let cancelled = false
    getMeal(id)
      .then((found) => {
        if (!cancelled) setLoaded({ id, meal: found ?? null, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ id, meal: null, error: err instanceof Error ? err.message : 'Something went wrong' })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Remember this recipe for the home page's "continue where you left off".
  const { user } = useAuth()
  const viewed = current?.meal
  useEffect(() => {
    if (user && viewed) markRecipeViewed(user.uid, viewed).catch((err) => console.error('Could not save recent recipe', err))
  }, [user, viewed])

  // Going back keeps the user's search results. If they opened this page
  // directly (no earlier page in the app), go to the recipes page instead.
  const cameFromApp = location.key !== 'default'
  const back = cameFromApp ? (
    <button className="back" onClick={() => navigate(-1)}>← Back to recipes</button>
  ) : (
    <Link className="back button" to="/recipes">← Back to recipes</Link>
  )

  if (!current) return <>{back}<p className="muted">Loading recipe…</p></>
  if (current.error) return <>{back}<p className="error">{current.error}</p></>
  const meal = current.meal
  if (!meal) return <>{back}<p className="muted">Recipe not found.</p></>

  // The API sends instructions as one string with line breaks; show each non-empty line as a paragraph.
  const steps = meal.instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  return (
    <article className="recipe">
      {back}
      <div className="recipe-header">
        <img src={meal.thumbnail} alt="" />
        <div>
          <div className="title-row">
            <h1>{meal.name}</h1>
            <SaveButton meal={meal} />
          </div>
          <p className="muted">{meal.category} · {meal.area}</p>
          {meal.tags.length > 0 && (
            <ul className="tags">
              {meal.tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
          {/* Only shown when the API has these links for the recipe. */}
          <div className="actions">
            {meal.youtube && <a className="button" href={meal.youtube} target="_blank" rel="noreferrer">Watch video</a>}
            {meal.source && <a className="button" href={meal.source} target="_blank" rel="noreferrer">Original recipe</a>}
          </div>
        </div>
      </div>

      <section>
        <h2>Ingredients</h2>
        <ul className="ingredient-list">
          {meal.ingredients.map((i, n) => (
            <li key={n}>
              <span>{i.name}</span>
              <span className="muted">{i.measure}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Instructions</h2>
        {steps.map((s, n) => <p key={n}>{s}</p>)}
      </section>
    </article>
  )
}
