import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'

function authErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the app yet.'
    default:
      return err instanceof Error ? err.message : 'Something went wrong'
  }
}

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const ref = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      // On success the dialog stays busy until Layout unmounts it for the signed-in user.
      await action()
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (signup && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    run(() => (signup ? signUpWithEmail(email.trim(), password) : signInWithEmail(email.trim(), password)))
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setConfirm('')
  }

  return (
    <dialog
      ref={ref}
      className="auth-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="auth-dialog-body">
        <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        <h2>{signup ? 'Create your account' : 'Sign in'}</h2>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="divider">or</p>
        <div className="stack">
          <button type="button" disabled={busy} onClick={() => run(signInWithGoogle)}>Continue with Google</button>
          {signup ? (
            <button type="button" disabled={busy} onClick={() => switchMode('signin')}>Back to sign in</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => switchMode('signup')}>Create account</button>
          )}
        </div>
      </div>
    </dialog>
  )
}
