import { useAuth } from '../context/AuthContext'
import ProfileForm from '../components/ProfileForm'

export default function ProfileSetup() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <>
      <h1>Welcome to SafeBite</h1>
      <p className="muted">A few quick questions so we can tailor recipes and product checks to you.</p>
      <ProfileForm profile={profile} submitLabel="Save and continue" />
    </>
  )
}
