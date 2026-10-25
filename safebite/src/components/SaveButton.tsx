// Star button on a recipe's page: saves the recipe to the user's favourites
// (shown on the home page) or removes it. Hidden when signed out.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isRecipeSaved, saveRecipe, unsaveRecipe } from '../lib/db'

export default function SaveButton({ meal }: { meal: { id: string; name: string; thumbnail: string } }) {
  const { user } = useAuth()
  // Whether this recipe is saved, tagged with the recipe it's for; null until checked.
  const [state, setState] = useState<{ id: string; saved: boolean } | null>(null)
  const saved = state?.id === meal.id ? state.saved : null
  const [error, setError] = useState('')

  // Check whether this recipe is already saved.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    isRecipeSaved(user.uid, meal.id)
      .then((saved) => {
        if (!cancelled) setState({ id: meal.id, saved })
      })
      .catch((err) => console.error('Could not check saved recipe', err))
    return () => {
      cancelled = true
    }
  }, [user, meal.id])

  if (!user) return null

  // Flip the star straight away, and flip it back if the save fails.
  async function toggle() {
    if (!user || saved === null) return
    setError('')
    setState({ id: meal.id, saved: !saved })
    try {
      if (saved) await unsaveRecipe(user.uid, meal.id)
      else await saveRecipe(user.uid, meal)
    } catch (err) {
      console.error(err)
      setState({ id: meal.id, saved })
      setError('Could not update your saved recipes.')
    }
  }

  return (
    <div>
      <button
        className="star"
        onClick={toggle}
        disabled={saved === null}
        aria-pressed={saved ?? false}
        aria-label={saved ? 'Remove from saved recipes' : 'Save recipe'}
        title={saved ? 'Saved' : 'Save recipe'}
      >
        {saved ? '★' : '☆'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
