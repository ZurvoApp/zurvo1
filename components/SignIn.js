'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './signin.module.css'

// A QR that encodes the /get install page, rendered on the desktop visual panel.
const qrSrc = (url) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&bgcolor=255-255-255&color=11-10-16&data=${encodeURIComponent(url)}`

/* The door. Phone OTP is the trusted default for Indian riders; Google is the
   one-tap option; email is a real account — an address and a password the rider
   chooses, held by Supabase Auth.

   Email is deliberately a TWO-state door, not one: signing in and creating an
   account ask for different things (a returning rider types one password, a new
   one confirms it), and blurring the two is how a person ends up with a second
   account for an address they already own. So the panel names which one it is,
   and the swap is one tap away.

   Google routes back through /auth/callback, which turns whatever Supabase hands
   back into a session. Phone OTP and email+password resolve in place — they never
   leave the app. AuthProvider notices the new session either way, and the
   on_auth_user_created trigger gives every new account its profile row.

   There is no shortcut in here and no build in which one appears. Every way
   through this screen is a way a member of the public can also come through. */
const redirectTo = () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback/` : undefined)
const resetRedirectTo = () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/reset/` : undefined)
const MIN_PW = 8

export default function SignIn() {
  const [mode, setMode] = useState('choose') // choose | phone | email
  const [authMode, setAuthMode] = useState('signin') // signin | signup — the email door only
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false) // signed up; the inbox has to confirm first
  const [resetSent, setResetSent] = useState(false) // password-recovery mail is on its way
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [getUrl, setGetUrl] = useState('') // /get URL for the QR + capsule
  const [installed, setInstalled] = useState(true) // assume installed until proven otherwise (hides the capsule)
  // Which sign-in methods the Supabase project actually has configured. We only
  // show a button once its provider is live, so a production visitor never taps a
  // method that would just error. Email is the always-on default.
  const [providers, setProviders] = useState(null) // null = still detecting

  useEffect(() => {
    setGetUrl(window.location.origin + '/get/')
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setInstalled(standalone)

    // If an OAuth round-trip just failed, AuthProvider stashed the reason — show it
    // here rather than leaving the rider staring at the login screen wondering why.
    try {
      const oauthErr = sessionStorage.getItem('zurvo:oauth-error')
      if (oauthErr) {
        setMsg({ tone: 'bad', text: oauthErr })
        sessionStorage.removeItem('zurvo:oauth-error')
      }
    } catch {}

    const u = process.env.NEXT_PUBLIC_SUPABASE_URL
    const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    fetch(`${u}/auth/v1/settings`, { headers: { apikey: k } })
      .then((r) => r.json())
      .then((s) =>
        setProviders({
          phone: !!s?.external?.phone,
          google: !!s?.external?.google,
          email: s?.external?.email !== false,
        }),
      )
      .catch(() => setProviders({ phone: false, google: false, email: true }))
  }, [])

  /* Supabase answers in API strings. A rider shouldn't have to read them. Every
     one of these is a dead end the person can actually act on, so each says what
     the next move is rather than what the server called the problem. */
  const humanise = (raw) => {
    const t = (raw || '').toLowerCase()
    if (t.includes('invalid login credentials'))
      return 'That email and password don’t match an account. Check the password, or create an account below.'
    if (t.includes('email not confirmed'))
      return 'Confirm your email first — open the link we sent when you signed up.'
    if (t.includes('already registered') || t.includes('already been registered'))
      return 'That email already has an account. Sign in instead.'
    if (t.includes('password should be')) return `Password is too short — use at least ${MIN_PW} characters.`
    if (t.includes('rate limit') || t.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
    return raw || 'Something went wrong. Try again.'
  }

  const fail = (e) => setMsg({ tone: 'bad', text: humanise(e?.message) })

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

  /* ---------------------------- email + password ---------------------------- */

  // A returning rider. The session lands immediately — no round-trip through an
  // inbox — and AuthProvider picks it up and swaps the screen out.
  const signIn = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)
    if (error) return fail(error)
    // success → AuthProvider swaps to the app (or onboarding)
  }

  /* A new rider. This writes the row in Supabase Auth; the on_auth_user_created
     trigger creates the matching profile row the rest of the app reads, so there
     is nothing to insert from here.

     Two outcomes, and both are normal. With "Confirm email" off, signUp returns a
     session and the rider goes straight to onboarding. With it on there is no
     session yet — the account exists but is unverified — so say that plainly
     instead of appearing to hang on a button that did in fact work. */
  const signUp = async () => {
    if (password.length < MIN_PW) return setMsg({ tone: 'bad', text: `Use at least ${MIN_PW} characters.` })
    if (password !== password2) return setMsg({ tone: 'bad', text: 'Both passwords need to match.' })

    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: redirectTo() },
    })
    setBusy(false)
    if (error) return fail(error)

    /* Supabase will not tell you an address is taken — that would let anyone probe
       who has an account — so it returns a user with an EMPTY identities array
       instead. That is the only signal we get, and without reading it the rider
       sits on "check your inbox" for a mail that never comes. */
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setAuthMode('signin')
      setPassword2('')
      return setMsg({ tone: 'bad', text: 'That email already has an account. Sign in instead.' })
    }

    if (data?.session) return // straight in → AuthProvider swaps to onboarding
    setConfirmSent(true)
  }

  /* Forgot password. Mails a recovery link that lands on /auth/reset, which is
     where the new password is actually chosen.

     The confirmation deliberately doesn't say whether that address has an account.
     Anyone can type any email into this box, so a truthful "no account here" would
     turn the login screen into a tool for finding out who rides with us. */
  const forgotPassword = async () => {
    const address = email.trim().toLowerCase()
    if (!address.includes('@') || address.length < 4)
      return setMsg({ tone: 'bad', text: 'Type your email address above first, then tap this.' })

    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: resetRedirectTo() })
    setBusy(false)
    if (error) return fail(error)
    setResetSent(true)
  }

  // Switching doors resets whatever the last one was waiting on.
  const go = (next) => {
    setMode(next)
    setSent(false)
    setConfirmSent(false)
    setResetSent(false)
    setCode('')
    setPassword('')
    setPassword2('')
    setShowPw(false)
    setMsg(null)
  }

  // Swapping between "sign in" and "create account" inside the email door.
  const swapAuthMode = () => {
    setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setPassword2('')
    setShowPw(false)
    setResetSent(false)
    setMsg(null)
  }

  const isSignup = authMode === 'signup'
  const emailOk = email.trim().length > 3 && email.includes('@')
  // Creating an account has to clear the length bar before the button lights up;
  // signing in must not, because an old account may predate that rule.
  const canSubmitEmail = busy
    ? false
    : isSignup
      ? emailOk && password.length >= MIN_PW && password2.length >= MIN_PW
      : emailOk && password.length > 0
  const submitEmail = () => (isSignup ? signUp() : signIn())

  return (
    <div className={styles.page}>
      {/* LEFT — the cinematic half, desktop only. Carries the brand and a QR so a
          laptop visitor can jump the app straight onto their phone (X-style). */}
      <aside className={styles.visual}>
        <picture>
          <source srcSet="/hero-ride.webp" type="image/webp" />
          <img className={styles.visualImg} src="/hero-ride.jpg" alt="" />
        </picture>
        <div className={styles.visualScrim} />
        <div className={styles.visualBody}>
          <div className={styles.visualBrand}>
            <img src="/icon.png" alt="" width={52} height={52} />
            <div>
              <h2>Zurvo</h2>
              <p>Ride with people. Not with strangers.</p>
            </div>
          </div>
          {getUrl && (
            <div className={styles.qrCard}>
              <img className={styles.qr} src={qrSrc(getUrl)} alt="Scan to install Zurvo" width={84} height={84} />
              <div>
                <b>Get the app</b>
                <span>Scan to install Zurvo on your phone</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT — the sign-in panel. On phone this is the whole screen. */}
      <div className={styles.panel}>
        {/* Phone-only capsule at the very top, mirroring the desktop QR. */}
        {!installed && (
          <a className={styles.getApp} href="/get/">
            <Down />
            Get the app
          </a>
        )}

        <div className={styles.panelInner}>
          <div className={styles.brand}>
            <img src="/icon.png" alt="" width={60} height={60} />
            <h1>{mode === 'email' && isSignup ? 'Create your Zurvo account' : 'Sign in to Zurvo'}</h1>
            <p>Ride with people. Not with strangers.</p>
          </div>

          {mode === 'choose' &&
            (providers === null ? (
              <div className={styles.methods} aria-busy="true" style={{ alignItems: 'center', padding: '12px 0' }}>
                <span className="auth-spinner" />
              </div>
            ) : (
              <div className={styles.methods}>
                {/* Phone first — the trusted default for Indian riders. */}
                {providers.phone && (
                  <button className="cta" onClick={() => go('phone')}>
                    Continue with phone
                  </button>
                )}
                {providers.google && (
                  <button className={styles.google} onClick={google} disabled={busy}>
                    <GoogleMark />
                    Continue with Google
                  </button>
                )}
                {/* Email is the always-on fallback. It's the primary button when it's
                    the only method live, and the "or … email" option otherwise. */}
                {providers.email && (providers.phone || providers.google) && (
                  <div className={styles.divider}>
                    <span>or</span>
                  </div>
                )}
                {providers.email && (
                  <button
                    className={providers.phone || providers.google ? styles.outline : 'cta'}
                    onClick={() => {
                      setAuthMode('signin')
                      go('email')
                    }}
                  >
                    Continue with email
                  </button>
                )}
              </div>
            ))}

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
          {resetSent ? (
            /* Worded so it reveals nothing: "if there's an account" is true whether
               or not there is one — see forgotPassword. */
            <div className={styles.sentBox}>
              <Envelope />
              <h2>Check your inbox</h2>
              <p>
                If there’s an account for <b>{email.trim().toLowerCase()}</b>, we’ve sent a link to set a new
                password. It expires in an hour.
              </p>
              <button
                className="cta"
                onClick={() => {
                  setResetSent(false)
                  setPassword('')
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : confirmSent ? (
            /* The account is already created — the only thing left is the click.
               Say that, so nobody signs up a second time thinking it failed. */
            <div className={styles.sentBox}>
              <Envelope />
              <h2>Confirm your email</h2>
              <p>
                Your account is created. We emailed <b>{email.trim().toLowerCase()}</b> — open the link in it, then
                come back and sign in with your password.
              </p>
              <button
                className="cta"
                onClick={() => {
                  setConfirmSent(false)
                  setAuthMode('signin')
                  setPassword2('')
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <label className={styles.field}>
                <span>Email address</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmitEmail && submitEmail()}
                  inputMode="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>

              <label className={styles.field}>
                <span>{isSignup ? 'Set a password' : 'Password'}</span>
                {/* Show/hide is not a nicety on a phone: a typo in a masked field
                    is invisible, and the rider has no other way to find it. */}
                <div className={styles.pwWrap}>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canSubmitEmail && submitEmail()}
                    type={showPw ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    placeholder={isSignup ? `At least ${MIN_PW} characters` : '••••••••'}
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {isSignup && (
                <label className={styles.field}>
                  <span>Confirm password</span>
                  <input
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canSubmitEmail && submitEmail()}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Type it once more"
                  />
                </label>
              )}

              {/* Only someone who already has a password can have forgotten it. */}
              {!isSignup && (
                <button type="button" className={styles.forgot} onClick={forgotPassword} disabled={busy}>
                  Forgot password?
                </button>
              )}

              <button className="cta" onClick={submitEmail} disabled={!canSubmitEmail} data-busy={busy}>
                {busy
                  ? isSignup
                    ? 'Creating account…'
                    : 'Signing in…'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
              </button>

              <p className={styles.hint}>
                {isSignup
                  ? 'Your name, city, and bike come next — this is just the account.'
                  : 'You’ll stay signed in on this device until you sign out.'}
              </p>

              <div className={styles.swap}>
                <span>{isSignup ? 'Already have an account?' : 'New to Zurvo?'}</span>
                <button type="button" onClick={swapAuthMode}>
                  {isSignup ? 'Sign in' : 'Create an account'}
                </button>
              </div>
            </>
          )}

          <button className={styles.text} onClick={() => go('choose')}>
            ← Other ways to sign in
          </button>
        </div>
      )}

          {msg && <p className={`${styles.msg} ${msg.tone === 'bad' ? styles.bad : styles.ok}`}>{msg.text}</p>}

          <p className={styles.legal}>Your money is held in escrow. We never ride with people we haven’t verified.</p>
        </div>
      </div>
    </div>
  )
}

function Down() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
