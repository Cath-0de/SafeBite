// The recipes page (route "/recipes"): shows recipes to browse on arrival and
// lets the user search TheMealDB, including for several items at once
// ("steak and pasta"). Signed-in users also see their own recipes and the ones
// other users shared (matching the search, if there is one), and can add one.
// Recipes with the user's allergies show (their page offers replacements) unless
// the toggle hides them. A search with too few recipes also looks online with the AI.
// No flare filtering yet.
// The search is kept in the URL ("/recipes?q=pasta") so going back from a
// recipe's page shows the same results again.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { browseMeals, parseExclusions, parseTerms, searchMeals, searchSuggestions, type Meal, type SearchResult } from '../api/mealdb'
import { useAuth } from '../context/AuthContext'
import { aiConfigured } from '../lib/ai'
import { exclusionsToAllergies, NO_ALLERGIES } from '../lib/allergens'
import { hasAllergen, hasExcluded, listUserRecipes, lookUpRecipes, matchesTerms } from '../lib/recipes'
import RecipeCard from '../components/RecipeCard'

// Recipes shown before any search, and how many search results each "Show more" reveals.
const BROWSE_COUNT = 10
const PAGE_SIZE = 8
// A search showing fewer recipes than this also looks online.
const MIN_RESULTS = 10
// The toggle's saved choice. Recipes with allergies show until the user turns them off.
const HIDE_KEY = 'safebite-hide-allergy-recipes'

export default function Recipes() {
  const [params, setParams] = useSearchParams()
  // The search that was submitted (from the URL); empty means just browsing.
  const q = params.get('q') ?? ''
  // What's typed in the search box, which may not have been submitted yet.
  const [query, setQuery] = useState(q)
  const { user, profile, loading } = useAuth()
  const allergies = profile ?? NO_ALLERGIES
  // Whether recipes with the user's allergies are hidden. Saved in this browser;
  // storage can be blocked (e.g. some private windows), and then it lasts for this visit.
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === 'true'
    } catch {
      return false
    }
  })
  function onToggle(show: boolean) {
    setHide(!show)
    try {
      localStorage.setItem(HIDE_KEY, String(!show))
    } catch {
      /* not saved */
    }
  }
  // What the search results depend on: the query, and the allergies being filtered out.
  const loadKey = JSON.stringify([q, hide && allergies.allergens])
  // The last load's outcome, tagged with the key it was for.
  // `search` is set only for searches, not browsing. null until the first load finishes.
  const [loaded, setLoaded] = useState<{ key: string; meals: Meal[]; search?: SearchResult; error: string } | null>(null)
  // How many of the loaded recipes are shown on screen.
  const [visible, setVisible] = useState(BROWSE_COUNT)
  // Still loading while the results on screen belong to a different query.
  const busy = loaded?.key !== loadKey
  const meals = loaded?.meals ?? null
  const error = loaded?.error ?? ''
  const search = loaded?.search
  const shown = (list: Meal[]) => (hide ? list.filter((m) => !hasAllergen(m, allergies)) : list)
  // What the search itself said to leave out ("without cheese"). The toggle doesn't bring these back.
  const excluded = exclusionsToAllergies(parseExclusions(q))
  const wanted = (m: Meal) => !hasExcluded(m, excluded)

  // Recipes from users (the user's own, and everyone's shared ones), tagged with whose view they are.
  const [community, setCommunity] = useState<{ uid: string; meals: Meal[] } | null>(null)
  const userRecipes = user && community?.uid === user.uid ? community.meals : []
  // The search's own reading of the query once it's done, which includes typo fixes.
  const terms = !q ? [] : !busy && search ? search.terms : parseTerms(q)
  const userMatches = userRecipes.filter((m) => !m.userRecipe?.ai && matchesTerms(m, terms) && wanted(m))
  // The AI's finding for this search, plus stored ones that match it. Its stored
  // recipes only show for a search, so they don't crowd the browsing page.
  const [online, setOnline] = useState<{ q: string; meals: Meal[]; error: string } | null>(null)
  const aiMatches = !q ? [] : [...new Map([
    ...userRecipes.filter((m) => m.userRecipe?.ai && matchesTerms(m, terms)),
    ...(online?.q === q ? online.meals : []),
  ].map((m) => [m.id, m])).values()].filter(wanted)
  const allRecipes = [...(meals ?? []).filter(wanted), ...userMatches, ...aiMatches]

  // Look online when a finished search shows too few recipes.
  // Waits for the user's own recipes so stored ones aren't searched for again, and
  // needs a signed-in user: results are stored under their account, and without a
  // profile there are no allergies to keep out of them.
  const needsAi = Boolean(aiConfigured && q && profile && !busy && !error && community?.uid === user?.uid && online?.q !== q && shown(allRecipes).length < MIN_RESULTS)
  useEffect(() => {
    if (!needsAi || !user || !profile) return
    let cancelled = false
    lookUpRecipes(user.uid, q, profile, meals ?? [], community?.meals ?? [])
      .then((found) => {
        if (!cancelled) setOnline({ q, meals: found, error: '' })
      })
      .catch((err) => {
        console.error('Could not look up recipes', err)
        if (!cancelled) setOnline({ q, meals: [], error: err instanceof Error ? err.message : 'Could not search online' })
      })
    return () => {
      cancelled = true
    }
  }, [needsAi, q, user, profile, meals, community])

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
    if (loading) return
    let cancelled = false
    const load: Promise<{ meals: Meal[]; search?: SearchResult }> = q
      ? searchMeals(q, (m) => !hasExcluded(m, exclusionsToAllergies(parseExclusions(q))) && !(hide && hasAllergen(m, profile ?? NO_ALLERGIES)))
          .then((search) => ({ meals: search.meals, search }))
      : browseMeals().then((all) => ({ meals: all.slice(0, BROWSE_COUNT) }))
    load
      .then((found) => {
        if (cancelled) return
        setLoaded({ key: loadKey, ...found, error: '' })
        setVisible(q ? PAGE_SIZE : BROWSE_COUNT)
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ key: loadKey, meals: [], error: err instanceof Error ? err.message : 'Something went wrong' })
      })
    return () => {
      cancelled = true
    }
  }, [q, loadKey, hide, profile, loading])

  // Names for the search box to suggest while typing.
  const [suggestions, setSuggestions] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    searchSuggestions()
      .then((names) => {
        if (!cancelled) setSuggestions(names)
      })
      // Searching still works without suggestions.
      .catch((err) => console.error('Could not load search suggestions', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Search submit: put the query in the URL, which triggers the load above.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setParams({ q: query.trim() })
  }

  const hiddenCount = allRecipes.filter((m) => hasAllergen(m, allergies)).length
  const shownMeals = shown((meals ?? []).filter(wanted))
  const nothingShown = !busy && !needsAi && !error && shown(allRecipes).length === 0

  return (
    <>
      <div className="title-row">
        <h1>Recipes</h1>
        <Link className="button primary" to="/recipes/new">+ Add a recipe</Link>
      </div>
      <div className="search-row">
        <form className="search" onSubmit={onSubmit}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try chicken, rice, garlic"
            aria-label="Search recipes"
            list="recipe-suggestions"
          />
          <datalist id="recipe-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
          <button className="primary" disabled={busy || !query.trim()}>{busy && q ? 'Searching…' : 'Search'}</button>
        </form>
        {/* Without allergies on the profile there's nothing to hide. */}
        {allergies.allergens.length > 0 && (
          <label className="switch">
            <input type="checkbox" role="switch" checked={!hide} onChange={(e) => onToggle(e.target.checked)} />
            Show recipes with my allergies &amp; replacements
          </label>
        )}
      </div>
      <p className="muted hint">Separate items with commas or “and”. Leave things out with “without cheese” or “dairy free”.</p>
      {error && <p className="error">{error}</p>}
      {/* How the search was read, and what to expect when the results aren't exact. */}
      {search && !busy && (
        <div className="search-summary">
          {search.corrected.map((c) => (
            <p key={c.from}>Showing results for <strong>{c.to}</strong> instead of “{c.from}”.</p>
          ))}
          {parseExclusions(q).length > 0 && <p>Leaving out <strong>{parseExclusions(q).join(', ')}</strong>.</p>}
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
      {hide && hiddenCount > 0 && <p className="muted">Hiding {hiddenCount} with your allergies.</p>}
      {shown(userMatches).length > 0 && (
        <section>
          <h2 className="section-title">From SafeBite users</h2>
          <div className="cards">
            {shown(userMatches).map((m) => <RecipeCard key={m.id} meal={m} />)}
          </div>
          <h2 className="section-title">From TheMealDB</h2>
        </section>
      )}
      {nothingShown && <p className="muted">No recipes found.</p>}
      {/* One card per recipe, limited to the first `visible` of them. Each opens the recipe's page. */}
      <div className="cards">
        {shownMeals.slice(0, visible).map((m) => <RecipeCard key={m.id} meal={m} />)}
      </div>
      {/* "Show more" appears only while some loaded recipes are still hidden. */}
      {shownMeals.length > visible && (
        <div className="actions">
          <button onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more</button>
        </div>
      )}
      {needsAi && <p className="muted" role="status">Looking online for more recipes…</p>}
      {online?.q === q && online.error && <p className="muted">Couldn't look online for more recipes: {online.error}</p>}
      {q && !user && !busy && aiConfigured && shownMeals.length < MIN_RESULTS && (
        <p className="muted">Sign in to look online for more recipes without your allergies.</p>
      )}
      {shown(aiMatches).length > 0 && (
        <section>
          <h2 className="section-title">Found online by AI</h2>
          <div className="cards">
            {shown(aiMatches).map((m) => <RecipeCard key={m.id} meal={m} />)}
          </div>
        </section>
      )}
    </>
  )
}
