import { createClient } from '@supabase/supabase-js'

/* The single browser Supabase client. It stays null until the project keys are
   present in the environment, which lets lib/api fall back to mock data so the
   app keeps running through the migration instead of showing empty screens. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // PKCE is the right flow for a browser/PWA app with no server secret.
        flowType: 'pkce',
        // The /auth/callback page runs the code exchange itself, so it can report
        // a clear error instead of a blank screen. Turning off auto-detection
        // avoids the client racing that exchange and consuming the code first.
        detectSessionInUrl: false,
      },
    })
  : null
