// One recipe's page (route "/recipes/:id"): picture, safety verdict,
// ingredients with amounts, and the full instructions. Ingredients with the
// user's allergies get AI advice (lib/ai.ts): can it be left out, and what to
// use instead. Any other ingredient has "Can't eat this?" for the same advice. The recipe is looked up by the id in the URL, so
// the page also works when refreshed or opened from a shared link. Recipes
// users wrote get a "Not verified" tag, and their owner can edit or delete them.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Meal } from '../api/mealdb'
import { aiConfigured, suggestSwaps } from '../lib/ai'
import { useAuth } from '../context/AuthContext'
import { deleteUserRecipe, markRecipeViewed } from '../lib/db'
import { allergenLabel, allergensIn, allergiesOf, maybeAllergensIn, type Allergies } from '../lib/allergens'
import { getRecipe, isUserRecipeId, USER_RECIPE_PREFIX } from '../lib/recipes'
import Button from '../components/Button'
import Chip from '../components/Chip'
import IngredientList, { type AdviceMap } from '../components/IngredientList'
import SafetyBadge from '../components/SafetyBadge'
import SaveButton from '../components/SaveButton'
import UnverifiedTag from '../components/UnverifiedTag'

// Asks for advice on these ingredients and returns an answer for every one of
// them ('none' if the AI gave nothing). A replacement containing another of the
// user's allergies is dropped, so it's never suggested.
async function fetchAdvice(meal: Meal, items: { ingredient: string; reason: string }[], allergies: Allergies): Promise<AdviceMap> {
  const avoid = [...allergies.allergens.map(allergenLabel), ...items.filter((i) => i.reason === "can't eat it").map((i) => i.ingredient)]
  const none: AdviceMap = Object.fromEntries(items.map((i) => [i.ingredient.toLowerCase(), 'none' as const]))
  try {
    const got = await suggestSwaps(meal, items, avoid)
    const out: AdviceMap = { ...none }
    for (const item of items) {
      const advice = got[item.ingredient.toLowerCase()]
      if (!advice) continue
      const own = allergensIn(allergies, [item.ingredient])
      const clash = advice.replacement && allergensIn(allergies, [advice.replacement]).some((label) => !own.includes(label))
      out[item.ingredient.toLowerCase()] = clash ? { ...advice, replacement: '' } : advice
    }
    return out
  } catch (err) {
    console.error('Could not get swap advice', err)
    return none
  }
}

// The advice map, with "loading" for flagged ingredients that have no answer yet.
function withLoading(meal: Meal, allergies: Allergies, map: AdviceMap): AdviceMap {
  const out = { ...map }
  for (const i of meal.ingredients) {
    const key = i.name.toLowerCase()
    if (!(key in out) && allergensIn(allergies, [i.name]).length) out[key] = 'loading'
  }
  return out
}

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

  // AI advice per ingredient, tagged with the recipe it's for.
  const [advice, setAdvice] = useState<{ id: string; map: AdviceMap }>({ id: '', map: {} })
  const adviceMap = viewed && advice.id === viewed.id ? advice.map : {}
  const mergeAdvice = (mealId: string, map: AdviceMap) =>
    setAdvice((prev) => ({ id: mealId, map: { ...(prev.id === mealId ? prev.map : {}), ...map } }))

  // Ask once per recipe about every ingredient with one of the user's allergies.
  useEffect(() => {
    if (!viewed || !aiConfigured) return
    const allergies = allergiesOf(profile)
    const items = viewed.ingredients.flatMap((i) => {
      const labels = allergensIn(allergies, [i.name])
      return labels.length ? [{ ingredient: i.name, reason: `contains ${labels.join(', ').toLowerCase()}` }] : []
    })
    if (!items.length) return
    let cancelled = false
    fetchAdvice(viewed, items, allergies).then((map) => {
      if (!cancelled) mergeAdvice(viewed.id, map)
    })
    return () => {
      cancelled = true
    }
  }, [viewed, profile])

  // "Can't eat this?" on an ingredient the profile didn't flag.
  function onCantEat(name: string) {
    if (!viewed) return
    const meal = viewed
    mergeAdvice(meal.id, { [name.toLowerCase()]: 'loading' })
    fetchAdvice(meal, [{ ingredient: name, reason: "can't eat it" }], allergiesOf(profile)).then((map) => mergeAdvice(meal.id, map))
  }

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
  // AI-found recipes are shared with everyone, so whoever ran the search doesn't get to edit them.
  const ai = Boolean(meal.userRecipe?.ai)
  const mine = Boolean(user && meal.userRecipe?.ownerId === user.uid && !ai)

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

  // The user's allergens found in this recipe, and ones that only a "maybe" ingredient hints at.
  const allergies = allergiesOf(profile)
  const myAllergens = allergies.allergens
  const ingredientNames = meal.ingredients.map((i) => i.name)
  const found = allergensIn(allergies, ingredientNames)
  const maybe = maybeAllergensIn(allergies, ingredientNames)

  // The API sends instructions as one string with line breaks; show each non-empty line as a paragraph.
  const steps = meal.instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  return (
    <article className="recipe">
      {back}
      <div className={meal.thumbnail ? 'recipe-header' : 'recipe-header no-image'}>
        {meal.thumbnail && <img src={meal.thumbnail} alt="" />}
        <div>
          {ai ? <Chip label="Found online by AI · could be wrong" tone="check" /> : meal.userRecipe && <UnverifiedTag mine={mine} />}
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
            <SafetyBadge
              // The AI's ingredient list can be wrong, so its recipes never show "Safe for you".
              status={found.length ? 'contains' : maybe.length || ai ? 'check' : 'safe'}
              allergens={found}
              reason={maybe.length ? `may contain ${maybe.map((m) => m.toLowerCase()).join(', ')}` : 'found online by AI, check the original recipe'}
              size="lg"
            />
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
        {aiConfigured && found.length > 0 && <p className="muted">Crossed-out ingredients have one of your allergies. Here's what you can do instead.</p>}
        <IngredientList
          ingredients={meal.ingredients}
          allergies={allergies}
          // Flagged ingredients show "Finding a swap…" until the advice arrives.
          advice={aiConfigured ? withLoading(meal, allergies, adviceMap) : undefined}
          onCantEat={aiConfigured ? onCantEat : undefined}
        />
      </section>

      <section>
        <h2>Instructions</h2>
        {steps.map((s, n) => <p key={n}>{s}</p>)}
      </section>
    </article>
  )
}
