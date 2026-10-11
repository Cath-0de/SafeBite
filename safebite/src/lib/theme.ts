// Light/dark mode. The choice is saved in this browser (localStorage) and
// applied as <html data-theme="light|dark">, which index.css reads.
// index.html applies the saved choice before the app loads, so the page never
// flashes the wrong colours; until the user picks one, it follows the device.
export type Theme = 'light' | 'dark'

// Keep this key in sync with the script in index.html.
const STORAGE_KEY = 'safebite-theme'

// The theme currently on the page.
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

// Switches the page to `theme` and remembers it for next time.
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // Storage can be blocked (e.g. some private windows); the switch still works for this visit.
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* not saved */
  }
}
