// The frame around every page: the header (brand, nav links, sign-in button or
// avatar) plus the area where the current page renders.
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'
import AuthDialog from './AuthDialog'
import ProfileSetup from '../pages/ProfileSetup'

export default function Layout() {
  const { user, profile, loading, needsSetup } = useAuth()
  // Whether the sign-in popup is showing.
  const [authOpen, setAuthOpen] = useState(false)

  // Reset once signed in, so the dialog doesn't reappear after a later sign-out.
  if (user && authOpen) setAuthOpen(false)

  return (
    <>
      <header className="site-header">
        <NavLink to="/" className="brand">SafeBite</NavLink>
        <nav>
          <NavLink to="/recipes">Recipes</NavLink>
          <NavLink to="/scan">Scan</NavLink>
        </nav>
        {/* Right side of the header: nothing while loading, the avatar when
            signed in, otherwise the "Sign in" button. */}
        <div className="auth">
          {!firebaseConfigured ? (
            <span className="muted">Firebase not configured</span>
          ) : loading ? null : user ? (
            // Avatar circle: links to the profile page. Shows the Google photo
            // if there is one, otherwise the first letter of the name or email.
            <NavLink to="/profile" className="avatar" aria-label="Your profile" title={user.email ?? 'Your profile'}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                (profile?.name || user.displayName || user.email || '?').charAt(0).toUpperCase()
              )}
            </NavLink>
          ) : (
            <button className="primary" onClick={() => setAuthOpen(true)}>Sign in</button>
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
    </>
  )
}
