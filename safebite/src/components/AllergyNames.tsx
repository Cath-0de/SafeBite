// One allergy's names on the profile form, in groups ("Dairy → Cheese: ricotta,
// mozzarella…"). Each group has a checkbox to avoid or allow all of it, and its
// names are chips the user can untick one by one. Amber groups only sometimes
// contain the allergy. There's Select all / Deselect all, a box to add a name
// we missed, and a line saying where the list came from.
import { useState } from 'react'
import { allergenLabel, ALLERGENS, groupsFor, type AllergyDetails } from '../lib/allergens'
import Button from './Button'

type Detail = AllergyDetails[string]

// Groups longer than this start folded, so big lists (artificial colours) don't swamp the page.
const FOLD_OVER = 10

export default function AllergyNames({ id, details, loading, onChange }: {
  id: string
  details: AllergyDetails
  loading: boolean // the AI is still suggesting names for this allergy
  onChange: (detail: Detail) => void
}) {
  const [adding, setAdding] = useState('')
  const detail = details[id] ?? {}
  const off = new Set(detail.off ?? [])
  const groups = groupsFor(id, details)
  const all = [...new Set(groups.flatMap((g) => g.names))]
  const ticked = all.filter((n) => !off.has(n)).length
  const builtIn = ALLERGENS.some((a) => a.id === id)
  const fromAi = !builtIn && Boolean(detail.names?.length)

  const setOff = (next: Set<string>) => onChange({ ...detail, off: [...next] })
  const toggle = (name: string) => {
    const next = new Set(off)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setOff(next)
  }
  // Ticking a group's box avoids all of its names; unticking allows all of them.
  const toggleGroup = (names: readonly string[], avoidAll: boolean) => {
    const next = new Set(off)
    names.forEach((n) => (avoidAll ? next.delete(n) : next.add(n)))
    setOff(next)
  }

  function add() {
    const name = adding.trim().toLowerCase()
    if (name && !all.includes(name)) onChange({ ...detail, extra: [...(detail.extra ?? []), name] })
    setAdding('')
  }

  return (
    <details className="allergy-names" open>
      <summary>
        <strong>{allergenLabel(id)}</strong>{' '}
        <span className="muted">· looking for {ticked} of {all.length}</span>
      </summary>
      <p className="muted">
        {loading ? 'Asking the AI what else this goes by…'
          : builtIn ? "From SafeBite's list."
          : fromAi ? 'Suggested by AI. Check these are right.'
          : 'Just the name you typed. Add others it goes by.'}
      </p>
      <div className="row select-all">
        <Button variant="ghost" onClick={() => setOff(new Set())} disabled={ticked === all.length}>Select all</Button>
        <Button variant="ghost" onClick={() => setOff(new Set(all))} disabled={ticked === 0}>Deselect all</Button>
      </div>
      {groups.map((g) => {
        const on = g.names.filter((n) => !off.has(n)).length
        const chips = (
          <div className="choices">
            {g.names.map((n) => (
              <label key={n} className={`choice name-chip${g.maybe ? ' name-maybe' : ''}`}>
                <input type="checkbox" checked={!off.has(n)} onChange={() => toggle(n)} />
                {n}
              </label>
            ))}
          </div>
        )
        return (
          <div key={g.label} className={`name-group${g.maybe ? ' maybe' : ''}`}>
            <label className="name-group-head">
              <input
                type="checkbox"
                checked={on === g.names.length}
                // Some but not all ticked: shown as a dash.
                ref={(el) => {
                  if (el) el.indeterminate = on > 0 && on < g.names.length
                }}
                onChange={() => toggleGroup(g.names, on < g.names.length)}
                aria-label={`Avoid all ${g.label}`}
              />
              <span>
                {g.label}{' '}
                <span className="muted">· {g.maybe ? 'maybe, flagged as Check · ' : ''}{on} of {g.names.length}</span>
              </span>
            </label>
            {g.names.length > FOLD_OVER ? (
              <details>
                <summary className="muted">Show the {g.names.length} names</summary>
                {chips}
              </details>
            ) : (
              chips
            )}
          </div>
        )
      })}
      <div className="other-allergy">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add a name we missed"
          aria-label={`Add a name for ${allergenLabel(id)}`}
          maxLength={40}
        />
        <Button onClick={add} disabled={!adding.trim()}>Add</Button>
      </div>
    </details>
  )
}
