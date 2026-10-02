import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ensureProfile, getProfile, updateProfile, type ProfileUpdate } from '../lib/db'
import type { Profile } from '../lib/schema'

interface AuthValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  // True until the user has answered the profile setup questions.
  needsSetup: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  saveProfile: (changes: ProfileUpdate) => Promise<void>
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
      let p: Profile | null = null
      if (u) {
        try {
          p = await ensureProfile(u)
        } catch (err) {
          console.error('Failed to load or create profile', err)
        }
      }
      // Set both together so the UI never sees a signed-in user without their profile.
      setUser(u)
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const value: AuthValue = {
    user,
    profile,
    loading,
    // ensureProfile writes createdAt and updatedAt in the same request, so they
    // stay equal until the first updateProfile call (the setup form). The name
    // check also catches profiles saved before the name question existed.
    needsSetup: profile !== null && (profile.createdAt.isEqual(profile.updatedAt) || !profile.name),
    signInWithGoogle: async () => {
      if (auth) await signInWithPopup(auth, new GoogleAuthProvider())
    },
    signInWithEmail: async (email, password) => {
      if (auth) await signInWithEmailAndPassword(auth, email, password)
    },
    signUpWithEmail: async (email, password) => {
      if (auth) await createUserWithEmailAndPassword(auth, email, password)
    },
    saveProfile: async (changes) => {
      if (!user) return
      await updateProfile(user.uid, changes)
      setProfile(await getProfile(user.uid))
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
