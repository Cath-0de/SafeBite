// The "Log a meal" popup on the Log page, also used to edit an entry: meal
// type, what you ate, how you felt afterwards, ingredients and notes.
// "What did you eat?" suggests the user's recently viewed and saved recipes;
// picking one links the entry to that recipe and fills in its ingredients.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { addMealLog, getRecentRecipes, getSavedRecipes, updateMealLog } from '../lib/db'
import { MEAL_TYPES, parseIngredients, RATINGS } from '../lib/meals'
import { getRecipe } from '../lib/recipes'
import type { MealLog, MealType } from '../lib/schema'
import Button from './Button'

// A first guess at the meal type from the time of day; the user can change it.
function guessMealType(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h >= 17 && h < 22 ? 'dinner' : 'snack'
}

type Suggestion = { id: string; name: string; thumbnail: string; source: 'Recently viewed' | 'Saved' }

type Entry = MealLog & { id: string }

export default function LogMealDialog({ entry, onClose, onSaved }: {
  entry?: Entry // the entry to edit; omitted for a new one
  onClose: () => void
  onSaved: (entry: Entry) => void
}) {
  const { user } = useAuth()
  const ref = useRef<HTMLDialogElement>(null)
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? guessMealType())
  const [meal, setMeal] = useState(entry?.mealDescription ?? '')
  // The recipe picked from the suggestions; only counts while the text still matches its name.
  const [recipe, setRecipe] = useState<{ id: string; name: string; thumbnail?: string } | null>(
    entry?.recipeId ? { id: entry.recipeId, name: entry.mealDescription, thumbnail: entry.recipeThumbnail } : null,
  )
  const [score, setScore] = useState<number | null>(entry?.symptomScore ?? null)
  const [ingredients, setIngredients] = useState(entry?.ingredients?.join(', ') ?? '')
  // The last recipe picked, so a slow ingredient fetch for an earlier pick is ignored.
  const lastPicked = useRef('')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Suggestions: recently viewed recipes first, then saved ones not already listed.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const q = meal.trim().toLowerCase()
  const matches = suggestions.filter((s) => s.name.toLowerCase().includes(q))
  const showList = listOpen && matches.length > 0

  // Open the <dialog> as a modal (dimmed backdrop, Esc to close) when it mounts.
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getRecentRecipes(user.uid, 10), getSavedRecipes(user.uid)])
      .then(([recent, saved]) => {
        if (cancelled) return
        const seen = new Set(recent.map((r) => r.id))
        setSuggestions([
          ...recent.map((r) => ({ ...r, source: 'Recently viewed' as const })),
          ...saved.filter((s) => !seen.has(s.id)).map((s) => ({ ...s, source: 'Saved' as const })),
        ])
      })
      // Without suggestions the box still works as a plain text field.
      .catch((err) => console.error('Could not load recipe suggestions', err))
    return () => {
      cancelled = true
    }
  }, [user])

  function pick(s: Suggestion) {
    setMeal(s.name)
    setRecipe({ id: s.id, name: s.name, thumbnail: s.thumbnail })
    setListOpen(false)
    setActive(-1)
    lastPicked.current = s.id
    getRecipe(s.id)
      .then((m) => {
        if (m && lastPicked.current === s.id) setIngredients(m.ingredients.map((i) => i.name).join(', '))
      })
      // The user can still type the ingredients themselves.
      .catch((err) => console.error('Could not load the recipe ingredients', err))
  }

  // Arrow keys move through the suggestions, Enter picks one, Esc closes the list (not the popup).
  function onMealKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setListOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (matches.length ? (i + step + matches.length) % matches.length : -1))
    } else if (e.key === 'Enter' && showList && active >= 0 && matches[active]) {
      e.preventDefault()
      pick(matches[active])
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      setListOpen(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || score === null || !meal.trim()) return
    setBusy(true)
    setError('')
    try {
      const linked = recipe?.name === meal.trim() ? recipe : null
      const list = parseIngredients(ingredients)
      const data: MealLog = {
        loggedAt: entry?.loggedAt ?? Timestamp.now(),
        mealType,
        mealDescription: meal.trim(),
        recipeId: linked?.id,
        recipeThumbnail: linked?.thumbnail,
        symptomScore: score,
        ingredients: list.length ? list : undefined,
        notes: notes.trim() || undefined,
      }
      if (entry) {
        await updateMealLog(user.uid, entry.id, data)
        onSaved({ id: entry.id, ...data })
      } else {
        const added = await addMealLog(user.uid, data)
        onSaved({ id: added.id, ...data })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this meal')
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog log-dialog"
      onClose={onClose}
      // A click on the dialog element itself (not its contents) is a click on the backdrop, so close.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-body">
        <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        <h2>{entry ? 'Edit meal' : 'Log a meal'}</h2>
        <form className="setup" onSubmit={onSubmit}>
          <fieldset>
            <legend>Which meal?</legend>
            <div className="choices">
              {MEAL_TYPES.map((t) => (
                <label key={t.id} className="choice">
                  <input type="radio" name="meal-type" checked={mealType === t.id} onChange={() => setMealType(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field-label" htmlFor="meal-input">What did you eat?</label>
            <input
              id="meal-input"
              value={meal}
              onChange={(e) => {
                setMeal(e.target.value)
                setListOpen(true)
                setActive(-1)
              }}
              onFocus={() => setListOpen(true)}
              onBlur={() => setListOpen(false)}
              onKeyDown={onMealKeyDown}
              placeholder="Type, or pick one of your recipes"
              maxLength={1000}
              autoComplete="off"
              required
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showList}
              aria-controls="meal-suggestions"
              aria-activedescendant={showList && active >= 0 ? `meal-suggestion-${active}` : undefined}
            />
            {showList && (
              // mousedown would blur the input and close the list before the click lands.
              <ul id="meal-suggestions" className="suggestions" role="listbox" aria-label="Your recipes" onMouseDown={(e) => e.preventDefault()}>
                {matches.map((s, i) => (
                  <li
                    key={s.id}
                    id={`meal-suggestion-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'active' : undefined}
                    onClick={() => pick(s)}
                    ref={(el) => {
                      if (el && i === active) el.scrollIntoView({ block: 'nearest' })
                    }}
                  >
                    {s.thumbnail ? <img src={s.thumbnail} alt="" loading="lazy" /> : <span className="thumb-placeholder" />}
                    <span>{s.name}</span>
                    <span className="muted">{s.source}</span>
                  </li>
                ))}
              </ul>
            )}
            {recipe?.name === meal.trim() && <p className="muted">Linked to this recipe.</p>}
          </div>

          <fieldset>
            <legend>How did you feel afterwards?</legend>
            <div className="choices rating">
              {RATINGS.map((r) => (
                <label key={r.score} className="choice">
                  <input type="radio" name="rating" checked={score === r.score} onChange={() => setScore(r.score)} required />
                  <span className="rating-symbol" aria-hidden="true">{r.symbol}</span>
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="field-label">Ingredients <span className="muted">(optional)</span></span>
            <span className="muted field-hint">Filled in when you pick a recipe. Separate with commas; edit if you changed anything.</span>
            <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="e.g. chicken, rice, garlic" maxLength={5000} />
          </label>

          <label className="field">
            <span className="field-label">Notes <span className="muted">(optional)</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth remembering?" maxLength={2000} />
          </label>

          {error && <p className="error">{error}</p>}
          <div className="actions">
            <Button type="submit" variant="primary" disabled={busy || !meal.trim() || score === null}>
              {busy ? 'Saving…' : entry ? 'Save changes' : 'Log meal'}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
