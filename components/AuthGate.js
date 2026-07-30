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

  if (!isSupabaseConfigured) return children // dev safety: don't lock a keyless build

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
