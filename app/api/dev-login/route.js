import { createClient } from '@supabase/supabase-js'

/* TESTING ONLY. Mints a session for a throwaway account so you can get into the
   app without email or a configured provider. It uses the service role, so it is
   hard-blocked outside development — it must never run in production. */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not available', { status: 403 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return Response.json({ error: 'Supabase env vars are not set' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  // A fresh account each time, so onboarding always runs.
  const email = `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}@zurvo.test`

  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (createErr) return Response.json({ error: createErr.message }, { status: 500 })

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // The client verifies this token_hash to establish the session in its own storage.
  return Response.json({ tokenHash: data.properties.hashed_token })
}
