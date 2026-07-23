'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef(null)

  const fetchProfile = async (userId) => {
    // The profile row is created by a DB trigger on sign-up, which can lag the
    // session by a beat — so if it's not there yet, retry once before giving up.
    let { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    if (!data) {
      await new Promise((r) => setTimeout(r, 900))
      ;({ data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle())
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

    supabase.auth.getSession().then(({ data }) => apply(data.session))
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
