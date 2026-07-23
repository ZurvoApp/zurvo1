'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './signin.module.css'

/* The door. Phone OTP is the trusted default for Indian riders; Google is the
   one-tap option; email sends a real magic link for everyone else.

   Google and the email link route back through /auth/callback, which turns
   whatever Supabase hands back into a session. Phone OTP resolves in place — it
   never leaves the app. AuthProvider notices the new session either way.

   The dev-only shortcut at the bottom of the email screen mints a throwaway
   account instantly. It exists because email is rate-limited and Google needs a
   provider set up; without it a misconfigured inbox locks you out of your own
   app. It renders only in development AND is refused by the server in
   production, so it can never become a real door. */
const redirectTo = () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback/` : undefined)
const IS_DEV = process.env.NODE_ENV === 'development'

export default function SignIn() {
  const [mode, setMode] = useState('choose') // choose | phone | email
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const fail = (e) => setMsg({ tone: 'bad', text: e?.message || 'Something went wrong. Try again.' })

  const google = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
    if (error) {
      fail(error)
      setBusy(false)
    }
    // on success the browser navigates to Google — no further UI here
  }

  const sendPhone = async () => {
    const e164 = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim().replace(/\D/g, '')}`
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 })
    setBusy(false)
    if (error) return fail(error)
    setSent(true)
    setPhone(e164)
    setMsg({ tone: 'ok', text: `Code sent to ${e164}` })
  }

  const verifyPhone = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' })
    setBusy(false)
    if (error) return fail(error)
    // success → AuthProvider swaps to the app
  }

  /* The emailed code. This is the reliable half of email sign-in.

     A magic LINK can fail through no fault of the rider: PKCE ties the link to
     the browser that asked for it (open it from the Gmail app and the verifier
     isn't there), and mail providers pre-fetch URLs to scan them, which spends
     the single-use token before a human ever clicks. A typed code has neither
     problem — it carries no browser secret and there is no URL to pre-fetch, so
     it also works when the mail is read on a different device. */
  const verifyEmailCode = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) return fail(error)
    // success → AuthProvider swaps to onboarding
  }

  /* A real magic link. shouldCreateUser defaults to true, so a first-time rider
     and a returning one take the identical path — there is no separate "sign up".
     The link lands on /auth/callback, which exchanges it for a session. */
  const sendEmail = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    })
    setBusy(false)
    if (error) return fail(error)
    setSent(true)
  }

  // Switching doors resets whatever the last one was waiting on.
  const go = (next) => {
    setMode(next)
    setSent(false)
    setCode('')
    setMsg(null)
  }

  // DEV ONLY: mint a throwaway session server-side, then establish it here.
  const testLogin = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/dev-login', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Test login is unavailable.')
      const { error } = await supabase.auth.verifyOtp({ token_hash: json.tokenHash, type: 'email' })
      if (error) throw error
      // success → AuthProvider swaps to onboarding
    } catch (e) {
      fail(e)
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <img src="/icon.png" alt="" width={64} height={64} />
        <h1>Zurvo</h1>
        <p>Ride with people. Not with strangers.</p>
      </div>

      {mode === 'choose' && (
        <div className={styles.methods}>
          <button className={styles.google} onClick={google} disabled={busy}>
            <GoogleMark />
            Continue with Google
          </button>
          <button className="cta" onClick={() => go('phone')}>
            Continue with phone
          </button>
          <button className={styles.text} onClick={() => go('email')}>
            Use email instead
          </button>
        </div>
      )}

      {mode === 'phone' && (
        <div className={styles.form}>
          {!sent ? (
            <>
              <label className={styles.field}>
                <span>Phone number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  autoFocus
                />
              </label>
              <button className="cta" onClick={sendPhone} disabled={busy || phone.trim().length < 6}>
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>Enter the 6-digit code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="······"
                  autoFocus
                />
              </label>
              <button className="cta" onClick={verifyPhone} disabled={busy || code.trim().length < 4}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
            </>
          )}
          <button className={styles.text} onClick={() => go('choose')}>
            ← Other ways to sign in
          </button>
        </div>
      )}

      {mode === 'email' && (
        <div className={styles.form}>
          {!sent ? (
            <>
              <label className={styles.field}>
                <span>Email address</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && !busy && sendEmail()}
                  inputMode="email"
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>
              <button className="cta" onClick={sendEmail} disabled={busy || !email.includes('@')} data-busy={busy}>
                {busy ? 'Sending…' : 'Send magic link'}
              </button>
              <p className={styles.hint}>No password. We’ll email you a link that signs you in.</p>
            </>
          ) : (
            <div className={styles.sentBox}>
              <Envelope />
              <h2>Check your inbox</h2>
              <p>
                We emailed <b>{email.trim()}</b>. Tap the link, or type the code from that email below.
              </p>

              {/* The code path works from any device — see verifyEmailCode. */}
              <label className={`${styles.field} ${styles.codeField}`}>
                <span>6-digit code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && code.trim().length >= 6 && !busy && verifyEmailCode()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="······"
                  autoFocus
                />
              </label>
              <button
                className="cta"
                onClick={verifyEmailCode}
                disabled={busy || code.trim().length < 6}
                data-busy={busy}
              >
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>

              <button className={styles.text} onClick={sendEmail} disabled={busy}>
                {busy ? 'Sending…' : 'Send it again'}
              </button>
            </div>
          )}

          {/* Dev-only escape hatch, so a rate-limited inbox never locks you out. */}
          {IS_DEV && !sent && (
            <button className={styles.devBtn} onClick={testLogin} disabled={busy}>
              Dev: skip email, log me in
            </button>
          )}

          <button className={styles.text} onClick={() => go('choose')}>
            ← Other ways to sign in
          </button>
        </div>
      )}

      {msg && <p className={`${styles.msg} ${msg.tone === 'bad' ? styles.bad : styles.ok}`}>{msg.text}</p>}

      <p className={styles.legal}>Your money is held in escrow. We never ride with people we haven’t verified.</p>
    </div>
  )
}

function Envelope() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.6" y="4.8" width="18.8" height="14.4" rx="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m3.4 6.6 8.6 6 8.6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}
