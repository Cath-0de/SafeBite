import { useEffect, useState, type FormEvent } from 'react'
import { browseMeals, searchMeals, type Meal } from '../api/mealdb'

// Recipes shown before any search, and how many search results each "Show more" reveals.
const BROWSE_COUNT = 10
const PAGE_SIZE = 8

export default function Recipes() {
  const [query, setQuery] = useState('')
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [visible, setVisible] = useState(BROWSE_COUNT)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Show some recipes to browse before the user has searched for anything.
  useEffect(() => {
    let cancelled = false
    browseMeals()
      .then((initial) => {
        if (!cancelled) setMeals((current) => current ?? initial.slice(0, BROWSE_COUNT))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setMeals(await searchMeals(query.trim()))
      setVisible(PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Recipes</h1>
      <form className="search" onSubmit={onSubmit}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try chicken or pasta" />
        <button className="primary" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {meals && meals.length === 0 && <p className="muted">No recipes found.</p>}
      <div className="cards">
        {meals?.slice(0, visible).map((m) => (
          <article key={m.id} className="card">
            <img src={m.thumbnail} alt="" loading="lazy" />
            <h2>{m.name}</h2>
            <p className="muted">{m.category} · {m.area}</p>
            <p className="ingredients">{m.ingredients.map((i) => i.name).join(', ')}</p>
          </article>
        ))}
      </div>
      {meals && meals.length > visible && (
        <div className="actions">
          <button onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more</button>
        </div>
      )}
    </>
  )
}
