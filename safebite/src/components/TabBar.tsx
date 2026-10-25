// The main navigation. index.css shows it as a bottom tab bar on phones and a
// vertical list in the left sidebar on desktop (1024px and up).
import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

// Add an entry here to add a tab.
const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/recipes', icon: 'recipes', label: 'Recipes' },
  { to: '/scan', icon: 'scan', label: 'Scan' },
  { to: '/log', icon: 'log', label: 'Log' },
  { to: '/profile', icon: 'profile', label: 'Profile' },
]

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <Icon name={t.icon} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
