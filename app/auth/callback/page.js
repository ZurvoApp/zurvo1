'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* Where every sign-in method lands. It accepts, in order:
     1. ?token_hash&type  — email links (verifyOtp; no browser secret needed)
     2. ?code             — Google / PKCE (exchange; needs the verifier from THIS browser)
     3. #access_token…    — implicit tokens in the URL hash (setSession)
   Anything else falls back to an existing session, and a genuine failure shows a
   plain message instead of a blank screen. */
export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    // The tokens here are single-use, and React's dev double-invoke would consume
    // the token twice — the second failing and clobbering the first success — so
    // this must run exactly once. No cancel flag: cancelling the only run would
    // verify the token but then never redirect.
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const url = new URL(window.location.href)
        const params = url.searchParams
        const errDesc = params.get('error_description')
        if (errDesc) throw new Error(errDesc)

        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        const code = params.get('code')
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
        const accessToken = hash.get('access_token')

        /* A recovery link belongs to /auth/reset, which spends the token and then
           asks for the new password. If one lands here — Supabase falls back to the
           Site URL when the reset URL isn't allow-listed — hand it over UNSPENT
           rather than verifying it, which would sign the person straight in with
           the password they've just told us they can't remember. */
        if (type === 'recovery' || hash.get('type') === 'recovery') {
          window.location.replace(`/auth/reset/${url.search}${url.hash}`)
          return
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
          if (error) throw error
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hash.get('refresh_token'),
          })
          if (error) throw error
        } else {
          const { data } = await supabase.auth.getSession()
          if (!data.session) throw new Error('This sign-in link is missing its token or has expired.')
        }

        router.replace('/')
      } catch (e) {
        setError(e?.message || 'That sign-in link could not be completed.')
      }
    })()
  }, [router])

  if (error)
    return (
      <div className="auth-loading" style={{ flexDirection: 'column', gap: 18, padding: 28, textAlign: 'center' }}>
        <p style={{ color: 'var(--t-2)', maxWidth: '34ch', lineHeight: 1.55, margin: 0 }}>{error}</p>
        <p style={{ color: 'var(--t-3)', fontSize: 12.5, maxWidth: '34ch', lineHeight: 1.5, margin: 0 }}>
          Request a fresh link and open it in this browser.
        </p>
        <button className="cta" style={{ maxWidth: 220 }} onClick={() => router.replace('/')}>
          Back to sign in
        </button>
      </div>
    )

  return (
    <div className="auth-loading" aria-busy="true">
      <span className="auth-spinner" />
    </div>
  )
}
