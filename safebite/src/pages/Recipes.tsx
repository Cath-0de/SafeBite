// The recipes page (route "/recipes"): shows recipes to browse on arrival and
// lets the user search TheMealDB, including for several items at once
// ("steak and pasta"). Signed-in users also see their own recipes and the ones
// other users shared (matching the search, if there is one), and can add one.
// No allergen or flare filtering yet.
// The search is kept in the URL ("/recipes?q=pasta") so going back from a
// recipe's page shows the same results again.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { browseMeals, parseTerms, searchMeals, type Meal, type SearchResult } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { listUserRecipes, matchesTerms } from '../lib/recipes'
import RecipeCard from '../components/RecipeCard'

// Recipes shown before any search, and how many search results each "Show more" reveals.
const BROWSE_COUNT = 10
const PAGE_SIZE = 8

export default function Recipes() {
  const [params, setParams] = useSearchParams()
  // The search that was submitted (from the URL); empty means just browsing.
  const q = params.get('q') ?? ''
  // What's typed in the search box, which may not have been submitted yet.
  const [query, setQuery] = useState(q)
  // The last load's outcome, tagged with the query it was for ('' = browsing).
  // `search` is set only for searches, not browsing. null until the first load finishes.
  const [loaded, setLoaded] = useState<{ q: string; meals: Meal[]; search?: SearchResult; error: string } | null>(null)
  // How many of the loaded recipes are shown on screen.
  const [visible, setVisible] = useState(BROWSE_COUNT)
  // Still loading while the results on screen belong to a different query.
  const busy = loaded?.q !== q
  const meals = loaded?.meals ?? null
  const error = loaded?.error ?? ''
  const search = loaded?.search

  // Recipes from users (the user's own, and everyone's shared ones), tagged with whose view they are.
  const { user } = useAuth()
  const [community, setCommunity] = useState<{ uid: string; meals: Meal[] } | null>(null)
  const userRecipes = user && community?.uid === user.uid ? community.meals : []
  const terms = q ? parseTerms(q) : []
  const userMatches = q ? userRecipes.filter((m) => matchesTerms(m, terms)) : userRecipes
  useEffect(() => {
    if (!user) return
    let cancelled = false
    listUserRecipes(user.uid)
      .then((meals) => {
        if (!cancelled) setCommunity({ uid: user.uid, meals })
      })
      // The TheMealDB results still show without these.
      .catch((err) => console.error('Could not load user recipes', err))
    return () => {
      cancelled = true
    }
  }, [user])

  // Load recipes whenever the submitted search changes: search results if there
  // is a query, otherwise some recipes to browse. `cancelled` stops a late
  // response from replacing newer results or updating the page after it's gone.
  useEffect(() => {
    let cancelled = false
    const load: Promise<{ meals: Meal[]; search?: SearchResult }> = q
      ? searchMeals(q).then((search) => ({ meals: search.meals, search }))
      : browseMeals().then((all) => ({ meals: all.slice(0, BROWSE_COUNT) }))
    load
      .then((found) => {
        if (cancelled) return
        setLoaded({ q, ...found, error: '' })
        setVisible(q ? PAGE_SIZE : BROWSE_COUNT)
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ q, meals: [], error: err instanceof Error ? err.message : 'Something went wrong' })
      })
    return () => {
      cancelled = true
    }
  }, [q])

  // Search submit: put the query in the URL, which triggers the load above.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setParams({ q: query.trim() })
  }

  return (
    <>
      <div className="title-row">
        <h1>Recipes</h1>
        <Link className="button primary" to="/recipes/new">+ Add a recipe</Link>
      </div>
      <form className="search" onSubmit={onSubmit}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try chicken, rice, garlic" />
        <button className="primary" disabled={busy || !query.trim()}>{busy && q ? 'Searching…' : 'Search'}</button>
      </form>
      <p className="muted hint">Looking for more than one thing? Separate items with commas or “and”.</p>
      {error && <p className="error">{error}</p>}
      {/* How the search was read, and what to expect when the results aren't exact. */}
      {search && !busy && (
        <div className="search-summary">
          {search.terms.length > 1 && (
            <p>Recipes with {search.terms.map((t, i) => <span key={t}>{i > 0 && ' + '}<strong>{t}</strong></span>)}</p>
          )}
          {search.unmatched.length > 0 && (
            <p className="muted">Nothing matched {search.unmatched.map((t) => `“${t}”`).join(', ')}.</p>
          )}
          {search.partial && search.unmatched.length === 0 && (
            <p className="muted">No recipe has all of these, so these are the closest matches.</p>
          )}
          {search.total > search.meals.length && (
            <p className="muted">Showing the top {search.meals.length} of {search.total} matches. Add another item to narrow it down.</p>
          )}
        </div>
      )}
      {userMatches.length > 0 && (
        <section>
          <h2 className="section-title">From SafeBite users</h2>
          <div className="cards">
            {userMatches.map((m) => <RecipeCard key={m.id} meal={m} />)}
          </div>
          <h2 className="section-title">From TheMealDB</h2>
        </section>
      )}
      {meals && !error && meals.length === 0 && <p className="muted">No recipes found.</p>}
      {/* One card per recipe, limited to the first `visible` of them. Each opens the recipe's page. */}
      <div className="cards">
        {meals?.slice(0, visible).map((m) => <RecipeCard key={m.id} meal={m} />)}
      </div>
      {/* "Show more" appears only while some loaded recipes are still hidden. */}
      {meals && meals.length > visible && (
        <div className="actions">
          <button onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more</button>
        </div>
      )}
    </>
  )
}
