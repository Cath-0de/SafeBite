import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ALLERGENS, allergenLabel } from '../lib/allergens'
import { parseAllergies } from '../lib/ai'
import type { CurrentState, EnergyLevel, Profile } from '../lib/schema'

// The answer options for the UC state and energy questions. `value` is what
// gets stored in Firestore; `label` is what the user sees.
const STATES: { value: CurrentState; label: string; hint: string }[] = [
  { value: 'remission', label: 'Remission', hint: 'Symptoms are calm' },
  { value: 'flare', label: 'Flare-up', hint: 'Symptoms are active' },
]

const ENERGY: { value: EnergyLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

// The name / allergen / state / energy questions, shared by first-time setup and the profile page.
export default function ProfileForm({ profile, submitLabel }: { profile: Profile; submitLabel: string }) {
  const { user, saveProfile } = useAuth()
  // The form's working copy of each answer, starting from the saved profile.
  // Nothing is written to Firestore until the form is submitted.
  // Google accounts come with a name, so offer it as the starting answer.
  const [name, setName] = useState(profile.name || user?.displayName || '')
  const [allergens, setAllergens] = useState<string[]>(profile.allergens)
  // What's typed in the "something else" box, before it's added.
  const [otherAllergy, setOtherAllergy] = useState('')
  // While Gemini reads the typed text, and what it found (or why it failed).
  const [parsing, setParsing] = useState(false)
  const [parseNote, setParseNote] = useState('')
  // Profiles made before this question existed were all UC users.
  const [hasUC, setHasUC] = useState(profile.hasUC ?? true)
  const [currentState, setCurrentState] = useState<CurrentState>(profile.currentState)
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(profile.energyLevel)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Add the allergen if it's unchecked, remove it if it's already checked.
  function toggleAllergen(id: string) {
    setSaved(false)
    setAllergens((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  // Allergies the user typed in themselves (anything that isn't a checkbox id).
  const custom = allergens.filter((a) => !ALLERGENS.some((k) => k.id === a))

  // Tick or add each allergy, skipping ones already there.
  function addAllergies(ids: string[]) {
    setSaved(false)
    setAllergens((prev) => [...new Set([...prev, ...ids])])
  }

  // Add the typed allergy. One or two words ("kiwi", "dairy") are added as typed,
  // ticking the matching checkbox if there is one. Anything longer ("milk makes
  // me bloated and I can't eat prawns") goes to Gemini to pick out the foods.
  // Either way nothing is saved until the user checks the answers and presses Save.
  async function addOtherAllergy() {
    const text = otherAllergy.trim().toLowerCase()
    if (!text) return
    setParseNote('')
    if (text.split(/\s+/).length <= 2) {
      const match = ALLERGENS.find((a) => a.id === text || a.label.toLowerCase() === text)
      addAllergies([match?.id ?? text])
      setOtherAllergy('')
      return
    }
    setParsing(true)
    try {
      const found = await parseAllergies(text)
      if (found.length) {
        addAllergies(found)
        setOtherAllergy('')
        setParseNote(`Added ${found.map(allergenLabel).join(', ')}. Check these are right before saving.`)
      } else {
        setParseNote("Couldn't find any foods in that. Try listing them, e.g. \"kiwi, prawns\".")
      }
    } catch (err) {
      console.error(err)
      setParseNote("Couldn't read that right now. Try typing just the food's name.")
    } finally {
      setParsing(false)
    }
  }

  // Save all the answers to profiles/{uid} (via saveProfile in AuthContext).
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await saveProfile({ name: name.trim(), allergens, hasUC, currentState, energyLevel })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="setup" onSubmit={onSubmit}>
      {/* Question 1: name (required, must contain a non-space character). */}
      <fieldset>
        <legend><label htmlFor="profile-name">What's your name?</label></legend>
        <input
          id="profile-name"
          value={name}
          onChange={(e) => {
            setSaved(false)
            setName(e.target.value)
          }}
          autoComplete="name"
          maxLength={100}
          pattern=".*\S.*"
          title="Enter your name"
          required
        />
      </fieldset>

      {/* Question 2: is this for UC? Decides whether questions 4 and 5 show. */}
      <fieldset>
        <legend>Are you using SafeBite for ulcerative colitis (UC)?</legend>
        <p className="muted">Either way, you can add food allergies below.</p>
        <div className="choices">
          {[{ value: true, label: 'Yes, I have UC' }, { value: false, label: 'No, just allergies' }].map((o) => (
            <label key={o.label} className="choice">
              <input
                type="radio"
                name="hasUC"
                checked={hasUC === o.value}
                onChange={() => {
                  setSaved(false)
                  setHasUC(o.value)
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Question 3: allergens, one checkbox per entry in lib/allergens.ts, plus any typed in. */}
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
          {/* Typed-in allergies, as chips that can be removed. */}
          {custom.map((a) => (
            <span key={a} className="choice">
              {allergenLabel(a)}
              <button type="button" className="remove" onClick={() => toggleAllergen(a)} aria-label={`Remove ${a}`}>×</button>
            </span>
          ))}
        </div>
        <div className="other-allergy">
          <input
            value={otherAllergy}
            onChange={(e) => setOtherAllergy(e.target.value)}
            // Enter adds the allergy instead of submitting the whole form.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOtherAllergy()
              }
            }}
            placeholder="Something else? e.g. kiwi, or describe it in your own words"
            aria-label="Add another allergy"
            maxLength={50}
          />
          <button type="button" onClick={addOtherAllergy} disabled={parsing || !otherAllergy.trim()}>
            {parsing ? 'Reading…' : 'Add'}
          </button>
        </div>
        {parseNote && <p className="muted" role="status">{parseNote}</p>}
      </fieldset>

      {/* Questions 4 and 5: UC flare state and energy. Only asked of UC users. */}
      {hasUC && (
        <>
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
        </>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {saved && <span className="muted saved">Saved</span>}
      </div>
    </form>
  )
}
