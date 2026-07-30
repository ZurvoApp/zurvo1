'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import SignIn from './SignIn'
import Onboarding from './Onboarding'
import { isSupabaseConfigured } from '@/lib/supabase'

/* The order of the front door:
     not logged in           -> sign-in
     logged in, no home city  -> onboarding (runs once)
     otherwise                -> the app
   Two routes are exempt and render without a session: the /auth/* callback (it
   must run WITHOUT one to create one), and /get (the public install page a
   logged-out visitor arrives on to download the app). */
export default function AuthGate({ children }) {
  const { user, profile, loading } = useAuth()
  const path = usePathname()
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  /* THE PUBLIC FRONT DOOR.
     Someone who opens the bare site in a normal browser tab is a visitor who
     doesn't have the app yet — send them to the pitch/install page, not a raw
     sign-in form. Three cases deliberately skip this and go straight in:
       • the installed app (display-mode: standalone) launching from the home
         screen — it should open the app, not re-pitch an install;
       • an explicit sign-in intent (/?signin=1), the link the /get page uses so
         "Open Zurvo" doesn't just bounce back to /get;
       • a logged-in user — they've passed the front door already.
     Only the exact root is redirected; deep links (/trip/…, /rides) keep showing
     sign-in so a shared link still works once you log in. */
  useEffect(() => {
    if (loading) return
    if (user) return
    if (path !== '/') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('signin')) return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (standalone) return
    setRedirecting(true)
    router.replace('/get/')
  }, [loading, user, path, router])

  if (path?.startsWith('/auth/')) return children
  if (path?.startsWith('/get')) return children

  if (redirecting)
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )

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
