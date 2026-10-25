// One recipe's page (route "/recipes/:id"): picture, safety verdict,
// ingredients with amounts (allergens crossed out with a swap where there is
// one), and the full instructions. The recipe is looked up by the id in the URL, so
// the page also works when refreshed or opened from a shared link. Recipes
// users wrote get a "Not verified" tag, and their owner can edit or delete them.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Meal } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { deleteUserRecipe, markRecipeViewed } from '../lib/db'
import { allergensIn } from '../lib/allergens'
import { getRecipe, isUserRecipeId, USER_RECIPE_PREFIX } from '../lib/recipes'
import Button from '../components/Button'
import IngredientList from '../components/IngredientList'
import SafetyBadge from '../components/SafetyBadge'
import SaveButton from '../components/SaveButton'
import UnverifiedTag from '../components/UnverifiedTag'

export default function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  // User recipes can only be read once sign-in is known, and who's signed in
  // changes what they can see, so those lookups are keyed by the user too.
  const key = isUserRecipeId(id) ? `${id}|${user?.uid ?? ''}` : id
  // The last lookup's outcome, tagged with the key it was for. meal is null if
  // no recipe has that id.
  const [loaded, setLoaded] = useState<{ key: string; meal: Meal | null; error: string } | null>(null)
  // Still loading while what's loaded belongs to a different key.
  const current = loaded?.key === key ? loaded : null
  const [deleteError, setDeleteError] = useState('')

  // Fetch the recipe whenever the id in the URL (or, for user recipes, the user) changes.
  useEffect(() => {
    if (isUserRecipeId(id) && loading) return
    let cancelled = false
    getRecipe(id)
      .then((found) => {
        if (!cancelled) setLoaded({ key, meal: found ?? null, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ key, meal: null, error: err instanceof Error ? err.message : 'Something went wrong' })
      })
    return () => {
      cancelled = true
    }
  }, [id, key, loading])

  // Remember this recipe for the home page's "continue where you left off".
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
  if (!meal) {
    const hint = isUserRecipeId(id) && !user ? ' Sign in to see recipes from SafeBite users.' : ''
    return <>{back}<p className="muted">Recipe not found.{hint}</p></>
  }
  const mine = Boolean(user && meal.userRecipe?.ownerId === user.uid)

  async function onDelete() {
    if (!meal || !window.confirm(`Delete "${meal.name}"? This can't be undone.`)) return
    setDeleteError('')
    try {
      await deleteUserRecipe(meal.id.slice(USER_RECIPE_PREFIX.length))
      navigate('/recipes', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this recipe')
    }
  }

  // The user's allergens found in this recipe.
  const myAllergens = profile?.allergens ?? []
  const found = allergensIn(myAllergens, meal.ingredients.map((i) => i.name))

  // The API sends instructions as one string with line breaks; show each non-empty line as a paragraph.
  const steps = meal.instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  return (
    <article className="recipe">
      {back}
      <div className={meal.thumbnail ? 'recipe-header' : 'recipe-header no-image'}>
        {meal.thumbnail && <img src={meal.thumbnail} alt="" />}
        <div>
          {meal.userRecipe && <UnverifiedTag mine={mine} />}
          <div className="title-row">
            <h1>{meal.name}</h1>
            <SaveButton meal={meal} />
          </div>
          <p className="muted">
            {[meal.category, meal.area].filter(Boolean).join(' · ')}
            {mine && ` · ${meal.userRecipe?.shared ? 'Shared with SafeBite users' : 'Private, only you can see it'}`}
          </p>
          {/* No verdict without allergies to check against, so "Safe for you" is never shown blindly. */}
          {myAllergens.length > 0 && (
            <SafetyBadge status={found.length ? 'contains' : 'safe'} allergens={found} size="lg" />
          )}
          {meal.tags.length > 0 && (
            <ul className="tags">
              {meal.tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
          {/* Only shown when the API has these links for the recipe. */}
          <div className="actions">
            {meal.youtube && <a className="button" href={meal.youtube} target="_blank" rel="noreferrer">Watch video</a>}
            {meal.source && <a className="button" href={meal.source} target="_blank" rel="noreferrer">Original recipe</a>}
            {mine && <Link className="button" to={`/recipes/${meal.id}/edit`}>Edit</Link>}
            {mine && <Button variant="ghost" onClick={onDelete}>Delete</Button>}
          </div>
          {deleteError && <p className="error">{deleteError}</p>}
        </div>
      </div>

      <section>
        <h2>Ingredients</h2>
        <IngredientList ingredients={meal.ingredients} allergenIds={myAllergens} />
      </section>

      <section>
        <h2>Instructions</h2>
        {steps.map((s, n) => <p key={n}>{s}</p>)}
      </section>
    </article>
  )
}
