'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { PROFILE_COLUMNS } from '@/lib/api'

/* Holds the current session and the rider's profile for the whole app. One
   subscription to Supabase auth, one profile fetch — every screen reads from
   here instead of asking the database who is logged in. */
const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const useAuth = () => useContext(AuthContext)

// Guards against exchanging the same OAuth code twice (React's dev double-invoke,
// or a stray re-render) — a code is single-use and the second attempt errors.
let oauthCodeHandled = false

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef(null)

  const fetchProfile = async (userId) => {
    // The profile row is created by a DB trigger on sign-up, which can lag the
    // session by a beat — so if it's not there yet, retry once before giving up.
    let { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle()
    if (!data) {
      await new Promise((r) => setTimeout(r, 900))
      ;({ data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle())
    }
    return data ?? null
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true

    const apply = async (session) => {
      const u = session?.user ?? null
      if (!active) return
      userRef.current = u
      setUser(u)
      setProfile(u ? await fetchProfile(u.id) : null)
      if (active) setLoading(false)
    }

    /* Complete an OAuth sign-in no matter where the code lands. Google returns
       the ?code to the URL Supabase decides on — and when the exact callback URL
       isn't allow-listed, Supabase falls back to the Site URL (the bare "/"),
       where the dedicated /auth/callback handler never runs. So exchange it here,
       on whatever page it arrives, then scrub the spent code from the address bar.
       The /auth/* callback runs its own exchange, so skip it there. */
    const init = async () => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code && !oauthCodeHandled) {
          oauthCodeHandled = true
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) throw error
          } catch (e) {
            // Surface WHY sign-in didn't complete instead of silently bouncing to
            // the login screen — SignIn reads this and shows it.
            console.error('[Zurvo] OAuth code exchange failed:', e?.message || e)
            try {
              sessionStorage.setItem('zurvo:oauth-error', e?.message || 'Sign-in could not be completed.')
            } catch {}
          }
          params.delete('code')
          const qs = params.toString()
          window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
        }
      }
      const { data } = await supabase.auth.getSession()
      apply(data.session)
    }

    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session))

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    const u = userRef.current
    if (u) setProfile(await fetchProfile(u.id))
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
