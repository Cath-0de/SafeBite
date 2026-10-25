// The profile page (route "/profile", the Profile tab): shows
// the account email, the editable profile questions, the light/dark mode
// choice, and the sign-out button.
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProfileForm from '../components/ProfileForm'
import ThemeToggle from '../components/ThemeToggle'

export default function Profile() {
  const { user, profile, loading, signOutUser } = useAuth()
  const navigate = useNavigate()

  // Wait for Firebase before deciding whether someone is signed in.
  if (loading) return null
  if (!user) return <p className="muted">Sign in to see your profile.</p>

  // Sign out, then go back to the home page.
  async function onSignOut() {
    await signOutUser()
    navigate('/')
  }

  return (
    <>
      <h1>Your profile</h1>
      <p className="muted">{user.email}</p>
      {/* The same form as first-time setup, pre-filled with the saved answers. */}
      {profile ? (
        <ProfileForm profile={profile} submitLabel="Save changes" />
      ) : (
        <p className="error">We couldn't load your profile. Try refreshing the page.</p>
      )}
      <section className="account">
        <h2>Appearance</h2>
        <ThemeToggle />
      </section>
      <section className="account">
        <h2>Account</h2>
        <button onClick={onSignOut}>Sign out</button>
      </section>
    </>
  )
}
