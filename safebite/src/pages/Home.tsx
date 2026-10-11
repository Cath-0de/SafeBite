// The landing page (route "/"): a greeting, a quick search, the user's saved
// (starred) recipes, and recipes recommended from the ones the user has opened before. Navigation lives in the nav bar (Layout.tsx).
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMeal, mealsInCategory, type Meal } from '../api/mealdb'
import RecipeCard from '../components/RecipeCard'
import { getRecentRecipes, getSavedRecipes } from '../lib/db'

type Suggestion = { id: string; name: string; thumbnail: string }

// Full recipes (with ingredients, for the allergy warnings) for a list of ids. Skips ids that no longer exist.
const fullMeals = async (ids: string[]) => (await Promise.all(ids.map(getMeal))).filter((m): m is Meal => Boolean(m))

// Recipes from the categories the user opens most (e.g. "Chicken", "Dessert"),
// skipping ones they've already seen. Shuffled so the picks change between visits.
async function recommend(uid: string, count = 6): Promise<Meal[]> {
  const recent = await getRecentRecipes(uid, 10)
  // The recent list only stores name and picture, so look up each recipe's category.
  const meals = await Promise.all(recent.map((r) => getMeal(r.id)))
  const tally = new Map<string, number>()
  for (const m of meals) if (m) tally.set(m.category, (tally.get(m.category) ?? 0) + 1)
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c)

  const seen = new Set(recent.map((r) => r.id))
  const lists = await Promise.all(top.map((c) => mealsInCategory(c)))
  const pools = lists.map((l) => l.filter((m) => !seen.has(m.id)).sort(() => Math.random() - 0.5))
  // Alternate between the categories so one doesn't crowd out the other.
  const picks: Suggestion[] = []
  for (let i = 0; picks.length < count && pools.some((p) => i < p.length); i++) {
    for (const p of pools) if (p[i] && picks.length < count) picks.push(p[i])
  }
  return fullMeals(picks.map((p) => p.id))
}

// Greeting that changes with the time of day.
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // Recommendations and saved recipes, tagged with the user they belong to; null until loaded.
  const [recs, setRecs] = useState<{ uid: string; items: Meal[] } | null>(null)
  const [saved, setSaved] = useState<{ uid: string; items: Meal[] } | null>(null)
  const items = user && recs?.uid === user.uid ? recs.items : []
  const savedItems = user && saved?.uid === user.uid ? saved.items : []

  // Load the signed-in user's saved recipes and build their recommendations.
  // Separate requests, so one failing doesn't hide the other row.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getSavedRecipes(user.uid)
      .then((list) => fullMeals(list.map((r) => r.id)))
      .then((items) => {
        if (!cancelled) setSaved({ uid: user.uid, items })
      })
      .catch((err) => console.error('Could not load saved recipes', err))
    recommend(user.uid)
      .then((items) => {
        if (!cancelled) setRecs({ uid: user.uid, items })
      })
      .catch((err) => console.error('Could not load recommendations', err))
    return () => {
      cancelled = true
    }
  }, [user])

  // Quick search: hand the query to the recipes page.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    navigate(`/recipes?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <>
      <section className="hero">
        <h1>{profile?.name ? `${greeting()}, ${profile.name} 🌷` : 'Eat with confidence.'}</h1>
        <p>
          {!user
            ? 'Sign in to find recipes that suit you, and pick up where you left off.'
            : profile?.hasUC !== false && profile?.currentState === 'flare'
              ? 'Go gently today. Here are some ideas to keep things easy.'
              : 'What are you in the mood for?'}
        </p>
        <form className="search" onSubmit={onSubmit}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, e.g. chicken and rice" aria-label="Search recipes" />
          <button className="primary" disabled={!query.trim()}>Search</button>
        </form>
      </section>

      {/* Only shown once the user has starred a recipe (star button on a recipe's page). */}
      {savedItems.length > 0 && (
        <section>
          <h2 className="section-title">★ Your saved recipes</h2>
          <div className="recent">
            {savedItems.map((m) => <RecipeCard key={m.id} meal={m} />)}
          </div>
        </section>
      )}

      {/* Only shown once the user has opened at least one recipe. */}
      {items.length > 0 && (
        <section>
          <h2 className="section-title">Recommended for you</h2>
          <div className="recent">
            {items.map((m) => <RecipeCard key={m.id} meal={m} />)}
          </div>
        </section>
      )}
    </>
  )
}
