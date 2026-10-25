// Add a recipe (route "/recipes/new") or edit one the user wrote
// ("/recipes/u_<id>/edit"). The user picks whether it stays private or is
// shared with every SafeBite user; either way it's tagged "Not verified".
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { addUserRecipe, updateUserRecipe, type UserRecipeInput } from '../lib/db'
import { getRecipe, USER_RECIPE_PREFIX } from '../lib/recipes'
import Button from '../components/Button'

type Draft = Omit<UserRecipeInput, 'tags'> & { tags: string }

const blankRow = () => ({ name: '', measure: '' })
const EMPTY: Draft = { name: '', category: '', area: '', ingredients: [blankRow(), blankRow(), blankRow()], instructions: '', tags: '', shared: false }

// Suggestions for the category box; any text is allowed.
const CATEGORIES = ['Breakfast', 'Starter', 'Side', 'Soup', 'Salad', 'Chicken', 'Beef', 'Pork', 'Lamb', 'Seafood', 'Pasta', 'Vegetarian', 'Vegan', 'Dessert', 'Snack', 'Drink']

// The draft as it's stored: trimmed, blank ingredient rows dropped, within firestore.rules' limits.
const toInput = (d: Draft): UserRecipeInput => ({
  name: d.name.trim(),
  category: d.category.trim(),
  area: d.area.trim(),
  ingredients: d.ingredients
    .map((i) => ({ name: i.name.trim().slice(0, 100), measure: i.measure.trim().slice(0, 50) }))
    .filter((i) => i.name)
    .slice(0, 50),
  instructions: d.instructions.trim(),
  tags: [...new Set(d.tags.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 10),
  shared: d.shared,
})

export default function RecipeForm() {
  const { id } = useParams() // set when editing
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  // Editing: which recipe's details are in the form, so it doesn't show the blank form as if it were loaded.
  const [loadedId, setLoadedId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }))
  const setRow = (n: number, changes: Partial<Draft['ingredients'][number]>) =>
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((row, i) => (i === n ? { ...row, ...changes } : row)) }))

  // Editing: load the recipe into the form, only if it's this user's.
  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    getRecipe(id)
      .then((m) => {
        if (cancelled) return
        if (!m || m.userRecipe?.ownerId !== user.uid) {
          setError('You can only edit recipes you added.')
          return
        }
        setDraft({
          name: m.name,
          category: m.category,
          area: m.area,
          ingredients: m.ingredients.length ? m.ingredients : [blankRow()],
          instructions: m.instructions,
          tags: m.tags.join(', '),
          shared: m.userRecipe.shared,
        })
        setLoadedId(id)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this recipe')
      })
    return () => {
      cancelled = true
    }
  }, [id, user])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const input = toInput(draft)
    if (!input.name || !input.instructions || !input.ingredients.length) {
      setError('Add a name, at least one ingredient, and the instructions.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (id) {
        await updateUserRecipe(id.slice(USER_RECIPE_PREFIX.length), input)
        navigate(`/recipes/${id}`)
      } else {
        const ref = await addUserRecipe(user.uid, input)
        navigate(`/recipes/${USER_RECIPE_PREFIX}${ref.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this recipe')
      setBusy(false)
    }
  }

  const title = id ? 'Edit recipe' : 'Add a recipe'
  if (loading) return <p className="muted">Loading…</p>
  if (!user) {
    return (
      <>
        <h1>{title}</h1>
        <div className="panel"><p>Sign in to add your own recipes.</p></div>
      </>
    )
  }
  if (id && loadedId !== id) return <><h1>{title}</h1>{error ? <p className="error">{error}</p> : <p className="muted">Loading recipe…</p>}</>

  return (
    <>
      <Link className="back button" to={id ? `/recipes/${id}` : '/recipes'}>← Back</Link>
      <h1>{title}</h1>
      <form className="setup recipe-form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Recipe name</span>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={200} required />
        </label>

        <div className="field-pair">
          <label className="field">
            <span className="field-label">Category <span className="muted">(optional)</span></span>
            <input value={draft.category} onChange={(e) => set({ category: e.target.value })} list="recipe-categories" maxLength={60} placeholder="e.g. Soup" />
            <datalist id="recipe-categories">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="field">
            <span className="field-label">Cuisine <span className="muted">(optional)</span></span>
            <input value={draft.area} onChange={(e) => set({ area: e.target.value })} maxLength={60} placeholder="e.g. Italian" />
          </label>
        </div>

        <fieldset>
          <legend>Ingredients</legend>
          <p className="muted">One per row. Your allergens are checked against these.</p>
          <div className="ingredient-rows">
            {draft.ingredients.map((row, n) => (
              <div key={n} className="ingredient-row">
                <input value={row.name} onChange={(e) => setRow(n, { name: e.target.value })} placeholder="Ingredient" aria-label={`Ingredient ${n + 1}`} maxLength={100} />
                <input value={row.measure} onChange={(e) => setRow(n, { measure: e.target.value })} placeholder="Amount" aria-label={`Amount for ingredient ${n + 1}`} maxLength={50} />
                <Button
                  variant="ghost"
                  onClick={() => set({ ingredients: draft.ingredients.filter((_, i) => i !== n) })}
                  disabled={draft.ingredients.length === 1}
                  aria-label={`Remove ingredient ${n + 1}`}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          {draft.ingredients.length < 50 && (
            <Button onClick={() => set({ ingredients: [...draft.ingredients, blankRow()] })}>+ Add ingredient</Button>
          )}
        </fieldset>

        <label className="field">
          <span className="field-label">Instructions</span>
          <textarea value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} rows={8} maxLength={20000} placeholder="One step per line" required />
        </label>

        <label className="field">
          <span className="field-label">Tags <span className="muted">(optional, separate with commas)</span></span>
          <input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="e.g. quick, gentle on the gut" />
        </label>

        <fieldset>
          <legend>Who can see it?</legend>
          <div className="choices">
            <label className="choice">
              <input type="radio" name="sharing" checked={!draft.shared} onChange={() => set({ shared: false })} />
              Only me
            </label>
            <label className="choice">
              <input type="radio" name="sharing" checked={draft.shared} onChange={() => set({ shared: true })} />
              Share with SafeBite users
            </label>
          </div>
          <p className="muted">Recipes from users show a “Not verified” tag, since nobody has checked them.</p>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <div className="actions">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Add recipe'}</Button>
        </div>
      </form>
    </>
  )
}
