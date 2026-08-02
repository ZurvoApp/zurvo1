'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import SignIn from './SignIn'
import Onboarding from './Onboarding'
import { isSupabaseConfigured } from '@/lib/supabase'

/* The order of the front door:
     not logged in           -> sign-in (the first screen, on phone AND laptop)
     logged in, no home city  -> onboarding (runs once)
     otherwise                -> the app
   The sign-in screen itself carries the "Get the app" install option, so the bare
   site is both the way in and the way to install — no forced download wall.
   Two routes render without a session: the /auth/* callback (it must run WITHOUT
   one to create one), and /get (the standalone install page). */
export default function AuthGate({ children }) {
  const { user, profile, loading } = useAuth()
  const path = usePathname()

  if (path?.startsWith('/auth/')) return children
  if (path?.startsWith('/get')) return children

  // No Supabase keys. Locally that just means "working on the UI without a
  // backend" — let it through. In PRODUCTION it means the deploy is misconfigured
  // (env vars missing), and we must NEVER fall open: a keyless build would
  // otherwise hand the whole app to anyone with no login. Lock it instead.
  if (!isSupabaseConfigured) {
    if (process.env.NODE_ENV !== 'production') return children
    return (
      <div className="auth-loading" style={{ flexDirection: 'column', gap: 14, padding: 28, textAlign: 'center' }}>
        <img src="/icon.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
        <p style={{ color: 'var(--t-1)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>
          Zurvo is being set up
        </p>
        <p style={{ color: 'var(--t-3)', fontSize: 13, maxWidth: '32ch', lineHeight: 1.5, margin: 0 }}>
          The server isn’t connected yet. Please check back in a moment.
        </p>
      </div>
    )
  }

  if (loading)
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )
  if (!user) return <SignIn />

  // Logged in but the profile row hasn't arrived yet (sign-up trigger lag).
  if (!profile)
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )

  // A rider is "onboarded" once they've set a home city.
  if (!profile.city) return <Onboarding />

  return children
}
