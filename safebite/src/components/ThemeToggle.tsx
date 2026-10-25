// The light/dark mode choice on the profile page. Each option shows a preview
// of that mode's colours (background, card, accent, text).
import { useState } from 'react'
import { currentTheme, setTheme, type Theme } from '../lib/theme'

const OPTIONS: { id: Theme; label: string; swatches: string[] }[] = [
  // Previews of the *other* theme can't come from CSS variables, so these copy
  // the values in index.css (:root and [data-theme='dark']); keep them in sync.
  { id: 'light', label: 'Light', swatches: ['#f7f4ec', '#eaf0ea', '#a0520f', '#1f3b33'] },
  { id: 'dark', label: 'Dark', swatches: ['#13201c', '#22362f', '#e0955a', '#a8cdb8'] },
]

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(currentTheme)

  function choose(next: Theme) {
    setTheme(next)
    setThemeState(next)
  }

  return (
    <div className="choices" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <label key={o.id} className="choice">
          <input type="radio" name="theme" checked={theme === o.id} onChange={() => choose(o.id)} />
          <span className="swatches" aria-hidden="true">
            {o.swatches.map((c) => <span key={c} style={{ background: c }} />)}
          </span>
          {o.label}
        </label>
      ))}
    </div>
  )
}
