import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProfileForm from '../components/ProfileForm'

export default function Profile() {
  const { user, profile, loading, signOutUser } = useAuth()
  const navigate = useNavigate()

  if (loading) return null
  if (!user) return <p className="muted">Sign in to see your profile.</p>

  async function onSignOut() {
    await signOutUser()
    navigate('/')
  }

  return (
    <>
      <h1>Your profile</h1>
      <p className="muted">{user.email}</p>
      {profile ? (
        <ProfileForm profile={profile} submitLabel="Save changes" />
      ) : (
        <p className="error">We couldn't load your profile. Try refreshing the page.</p>
      )}
      <section className="account">
        <h2>Account</h2>
        <button onClick={onSignOut}>Sign out</button>
      </section>
    </>
  )
}
