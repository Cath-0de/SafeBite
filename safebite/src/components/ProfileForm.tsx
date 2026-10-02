import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ALLERGENS } from '../lib/allergens'
import type { CurrentState, EnergyLevel, Profile } from '../lib/schema'

const STATES: { value: CurrentState; label: string; hint: string }[] = [
  { value: 'remission', label: 'Remission', hint: 'Symptoms are calm' },
  { value: 'flare', label: 'Flare-up', hint: 'Symptoms are active' },
]

const ENERGY: { value: EnergyLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

// The allergen / state / energy questions, shared by first-time setup and the profile page.
export default function ProfileForm({ profile, submitLabel }: { profile: Profile; submitLabel: string }) {
  const { saveProfile } = useAuth()
  const [allergens, setAllergens] = useState<string[]>(profile.allergens)
  const [currentState, setCurrentState] = useState<CurrentState>(profile.currentState)
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(profile.energyLevel)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  function toggleAllergen(id: string) {
    setSaved(false)
    setAllergens((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await saveProfile({ allergens, currentState, energyLevel })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="setup" onSubmit={onSubmit}>
      <fieldset>
        <legend>Do you have any food allergies or restrictions?</legend>
        <p className="muted">Select all that apply, or leave blank if none.</p>
        <div className="choices">
          {ALLERGENS.map((a) => (
            <label key={a.id} className="choice">
              <input type="checkbox" checked={allergens.includes(a.id)} onChange={() => toggleAllergen(a.id)} />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>How is your UC right now?</legend>
        <div className="choices">
          {STATES.map((s) => (
            <label key={s.value} className="choice">
              <input
                type="radio"
                name="currentState"
                checked={currentState === s.value}
                onChange={() => {
                  setSaved(false)
                  setCurrentState(s.value)
                }}
              />
              {s.label} <span className="muted">· {s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>How is your energy today?</legend>
        <div className="choices">
          {ENERGY.map((l) => (
            <label key={l.value} className="choice">
              <input
                type="radio"
                name="energyLevel"
                checked={energyLevel === l.value}
                onChange={() => {
                  setSaved(false)
                  setEnergyLevel(l.value)
                }}
              />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {saved && <span className="muted saved">Saved</span>}
      </div>
    </form>
  )
}
