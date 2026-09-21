import { useState, type FormEvent } from 'react'
import { searchMeals, type Meal } from '../api/mealdb'

export default function Recipes() {
  const [query, setQuery] = useState('')
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setMeals(await searchMeals(query.trim()))
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
        {meals?.map((m) => (
          <article key={m.id} className="card">
            <img src={m.thumbnail} alt="" loading="lazy" />
            <h2>{m.name}</h2>
            <p className="muted">{m.category} · {m.area}</p>
            <p className="ingredients">{m.ingredients.map((i) => i.name).join(', ')}</p>
          </article>
        ))}
      </div>
    </>
  )
}
