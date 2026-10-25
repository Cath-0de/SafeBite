// The frame around every page. Phones: a top bar (brand + sign in) and the tab
// bar along the bottom. Desktop: the same pieces stacked in a left sidebar.
// The current page renders in <main>.
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'
import AuthDialog from './AuthDialog'
import Button from './Button'
import TabBar from './TabBar'
import ProfileSetup from '../pages/ProfileSetup'

export default function Layout() {
  const { user, loading, needsSetup } = useAuth()
  // Whether the sign-in popup is showing.
  const [authOpen, setAuthOpen] = useState(false)

  // Reset once signed in, so the dialog doesn't reappear after a later sign-out.
  if (user && authOpen) setAuthOpen(false)

  return (
    <div className="shell">
      <header className="sidebar">
        <NavLink to="/" className="brand">SafeBite</NavLink>
        <TabBar />
        {/* Sign-in button while signed out; signed-in users reach their account through the Profile tab. */}
        <div className="auth">
          {!firebaseConfigured ? (
            <span className="muted">Firebase not configured</span>
          ) : (
            !loading && !user && <Button variant="primary" onClick={() => setAuthOpen(true)}>Sign in</Button>
          )}
        </div>
      </header>
      <main>
        {/* New users must answer the setup questions before seeing any page.
            <Outlet /> is the page for the current route (see App.tsx). */}
        {needsSetup ? <ProfileSetup /> : <Outlet />}
      </main>
      {/* The sign-in popup, shown only while open and signed out. */}
      {authOpen && !user && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
