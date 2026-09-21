import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'

export default function Layout() {
  const { user, loading, signIn, signOutUser } = useAuth()

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
            <>
              <span className="muted">{user.displayName ?? user.email}</span>
              <button onClick={signOutUser}>Sign out</button>
            </>
          ) : (
            <button className="primary" onClick={signIn}>Sign in with Google</button>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
