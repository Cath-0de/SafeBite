import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ensureProfile } from '../lib/db'
import type { Profile } from '../lib/schema'

interface AuthValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(auth))

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      let p: Profile | null = null
      if (u) {
        try {
          p = await ensureProfile(u)
        } catch (err) {
          console.error('Failed to load or create profile', err)
        }
      }
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const value: AuthValue = {
    user,
    profile,
    loading,
    signIn: async () => {
      if (auth) await signInWithPopup(auth, new GoogleAuthProvider())
    },
    signOutUser: async () => {
      if (auth) await signOut(auth)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
