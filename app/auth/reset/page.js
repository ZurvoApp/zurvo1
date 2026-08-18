'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from '@/components/signin.module.css'

/* Where a recovery link lands. The link itself is the proof of identity — it
   carries a single-use token for the address that asked — so this page spends
   that token first, and only then shows the form.

   Order matters. Rendering the form before the token is verified would invite
   someone to type a new password into a page that has no authority to set one,
   and the failure would arrive only after they'd committed to it.

   The spent token is scrubbed from the address bar immediately: recovery URLs get
   pasted into chats and left in shared browser history, and there is no reason for
   it to outlive the exchange. */
const MIN_PW = 8

export default function ResetPassword() {
  const router = useRouter()
  const [stage, setStage] = useState('verifying') // verifying | ready | done
  const [error, setError] = useState(null)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    // Single-use token, and React's dev double-invoke would spend it twice — the
    // second attempt failing and clobbering the first success. Run exactly once.
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

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || 'recovery' })
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
          // Someone opened /auth/reset with nothing attached. A session from a
          // recovery click earlier in this browser still counts.
          const { data } = await supabase.auth.getSession()
          if (!data.session) throw new Error('This reset link is missing its token, or it has already been used.')
        }

        window.history.replaceState({}, '', window.location.pathname)
        setStage('ready')
      } catch (e) {
        setError(e?.message || 'That reset link could not be opened.')
      }
    })()
  }, [])

  const save = async () => {
    if (password.length < MIN_PW) return setMsg({ tone: 'bad', text: `Use at least ${MIN_PW} characters.` })
    if (password !== password2) return setMsg({ tone: 'bad', text: 'Both passwords need to match.' })

    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      const t = (error.message || '').toLowerCase()
      if (t.includes('should be different'))
        return setMsg({ tone: 'bad', text: 'That’s your current password — choose a different one.' })
      if (t.includes('password should be'))
        return setMsg({ tone: 'bad', text: `Password is too short — use at least ${MIN_PW} characters.` })
      return setMsg({ tone: 'bad', text: error.message })
    }
    setStage('done')
  }

  const canSave = !busy && password.length >= MIN_PW && password2.length >= MIN_PW

  if (error)
    return (
      <Shell title="Reset link expired">
        <div className={styles.form}>
          <p className={`${styles.msg} ${styles.bad}`}>{error}</p>
          <p className={styles.hint}>Ask for a fresh link from the sign-in screen and open it in this browser.</p>
          <button className="cta" onClick={() => router.replace('/')}>
            Back to sign in
          </button>
        </div>
      </Shell>
    )

  if (stage === 'verifying')
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )

  if (stage === 'done')
    return (
      <Shell title="Password updated">
        <div className={styles.form}>
          <p className={styles.hint}>
            You’re signed in with your new password. It’s the one to use from now on.
          </p>
          <button className="cta" onClick={() => router.replace('/')}>
            Continue to Zurvo
          </button>
        </div>
      </Shell>
    )

  return (
    <Shell title="Set a new password">
      <div className={styles.form}>
        <label className={styles.field}>
          <span>New password</span>
          <div className={styles.pwWrap}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSave && save()}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PW} characters`}
              autoFocus
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

        <label className={styles.field}>
          <span>Confirm password</span>
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSave && save()}
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Type it once more"
          />
        </label>

        <button className="cta" onClick={save} disabled={!canSave} data-busy={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>

        {msg && <p className={`${styles.msg} ${msg.tone === 'bad' ? styles.bad : styles.ok}`}>{msg.text}</p>}
      </div>
    </Shell>
  )
}

// The sign-in panel without the door — same ground, type, and spacing, so a
// recovery link doesn't feel like it left the app.
function Shell({ title, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.brand}>
            <img src="/icon.png" alt="" width={60} height={60} />
            <h1>{title}</h1>
            <p>Ride with people. Not with strangers.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
