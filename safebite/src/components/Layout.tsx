import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'
import AuthDialog from './AuthDialog'
import ProfileSetup from '../pages/ProfileSetup'

export default function Layout() {
  const { user, profile, loading, needsSetup } = useAuth()
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
        <div className="auth">
          {!firebaseConfigured ? (
            <span className="muted">Firebase not configured</span>
          ) : loading ? null : user ? (
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
        {needsSetup ? <ProfileSetup /> : <Outlet />}
      </main>
      {authOpen && !user && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </>
  )
}
