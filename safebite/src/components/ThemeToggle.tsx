// The light/dark mode choice on the profile page. Each option shows a preview
// of that mode's colours (background, card, accent, text).
import { useState } from 'react'
import { currentTheme, setTheme, type Theme } from '../lib/theme'

const OPTIONS: { id: Theme; label: string; swatches: string[] }[] = [
  { id: 'light', label: 'Light', swatches: ['#fdf0d1', '#ac7d88', '#85586f', '#643843'] },
  { id: 'dark', label: 'Dark', swatches: ['#24151a', '#643843', '#ac7d88', '#fdf0d1'] },
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
