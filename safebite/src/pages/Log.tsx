// The meal & symptom log (route "/log"): past entries first (newest first,
// filterable by meal type), each with Edit and Delete, and a button that opens
// the "Log a meal" popup.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteMealLog, getMealLogs } from '../lib/db'
import type { MealLog, MealType } from '../lib/schema'
import Button from '../components/Button'
import Card from '../components/Card'
import LogMealDialog from '../components/LogMealDialog'
import { MEAL_TYPES, RATINGS } from '../lib/meals'

// The rating closest to a stored score.
const ratingFor = (score: number) =>
  RATINGS.reduce((best, r) => (Math.abs(r.score - score) < Math.abs(best.score - score) ? r : best))

const FILTERS: { id: MealType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  ...MEAL_TYPES.map((t) => ({ id: t.id, label: t.id === 'snack' ? 'Snacks' : t.label })),
]

type Entry = MealLog & { id: string }

export default function Log() {
  const { user, loading } = useAuth()
  // Past entries, tagged with whose they are so another account's never show.
  const [loaded, setLoaded] = useState<{ uid: string; entries: Entry[] } | null>(null)
  const logs = user && loaded?.uid === user.uid ? loaded.entries : null
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<MealType | 'all'>('all')
  // The open popup: a new entry ({}), an entry being edited, or none (null).
  const [dialog, setDialog] = useState<{ entry?: Entry } | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getMealLogs(user.uid)
      .then((entries) => {
        if (!cancelled) setLoaded({ uid: user.uid, entries })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your log')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Update the list in place instead of reloading it: an edited entry keeps its
  // spot (its time doesn't change), a new one goes on top.
  function onSaved(entry: Entry) {
    if (!user) return
    const editing = Boolean(dialog?.entry)
    setLoaded((l) => {
      const entries = l?.uid === user.uid ? l.entries : []
      return { uid: user.uid, entries: editing ? entries.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...entries] }
    })
    setDialog(null)
    setStatus(editing ? 'Changes saved.' : 'Meal logged.')
  }

  async function onDelete(entry: Entry) {
    if (!user || !window.confirm(`Delete "${entry.mealDescription}" from your log?`)) return
    setError('')
    try {
      await deleteMealLog(user.uid, entry.id)
      setLoaded((l) => l && { ...l, entries: l.entries.filter((e) => e.id !== entry.id) })
      setStatus('Meal deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this meal')
    }
  }

  if (loading) return <p className="muted">Loading…</p>
  if (!user) {
    return (
      <>
        <h1>Meal log</h1>
        <div className="panel">
          <p>Sign in to log your meals and how you felt afterwards.</p>
        </div>
      </>
    )
  }

  const shown = logs?.filter((l) => filter === 'all' || l.mealType === filter) ?? []
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label.toLowerCase()

  return (
    <>
      <div className="title-row">
        <h1>Meal log</h1>
        <Button variant="primary" onClick={() => { setStatus(''); setDialog({}) }}>+ Log a meal</Button>
      </div>
      <p className="muted" role="status">{status}</p>

      <fieldset className="filters">
        <legend className="visually-hidden">Show</legend>
        <div className="choices">
          {FILTERS.map((f) => (
            <label key={f.id} className="choice">
              <input type="radio" name="log-filter" checked={filter === f.id} onChange={() => setFilter(f.id)} />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      {logs === null ? (
        !error && <p className="muted">Loading your log…</p>
      ) : shown.length === 0 ? (
        <p className="muted">{filter === 'all' ? 'Nothing logged yet.' : `No ${filterLabel} logged yet.`}</p>
      ) : (
        <ul className="log-list">
          {shown.map((l) => {
            const r = ratingFor(l.symptomScore)
            const type = MEAL_TYPES.find((t) => t.id === l.mealType)?.label
            return (
              <li key={l.id}>
                <Card className="log-card">
                  {l.recipeThumbnail && <img src={l.recipeThumbnail} alt="" loading="lazy" />}
                  <div className="log-body">
                    <div className="log-head">
                      <strong>{l.mealDescription}</strong>
                      <span><span aria-hidden="true">{r.symbol}</span> {r.label}</span>
                    </div>
                    <p className="muted">
                      {type && `${type} · `}
                      {l.loggedAt.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {l.ingredients && <p className="muted">Ingredients: {l.ingredients.join(', ')}</p>}
                    {l.notes && <p>{l.notes}</p>}
                    <div className="log-actions">
                      {l.recipeId && <Link to={`/recipes/${l.recipeId}`}>View recipe</Link>}
                      <Button variant="ghost" onClick={() => { setStatus(''); setDialog({ entry: l }) }} aria-label={`Edit ${l.mealDescription}`}>Edit</Button>
                      <Button variant="ghost" onClick={() => onDelete(l)} aria-label={`Delete ${l.mealDescription}`}>Delete</Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {dialog && <LogMealDialog entry={dialog.entry} onClose={() => setDialog(null)} onSaved={onSaved} />}
    </>
  )
}
