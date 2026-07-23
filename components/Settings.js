'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthProvider'
import styles from './settings.module.css'

/* Settings is where the app stops performing and starts obeying. Every control
   here does the thing it says: the toggles persist, sign-out actually forgets
   you. A settings screen full of switches that spring back is worse than none —
   it teaches the user the app is a facade. */
const PREFS_KEY = 'zurvo:prefs'
const VERIFIED_KEY = 'zurvo:organiser-verified'

const TOGGLES = [
  { group: 'Notifications', items: [
    { id: 'notifReminders', label: 'Ride reminders', sub: 'The night before you meet', on: true },
    { id: 'notifKnown', label: 'When a rider you know joins', sub: 'The reason most people open Zurvo', on: true },
    { id: 'notifReplies', label: 'Organiser replies', sub: 'When someone you asked writes back', on: true },
    { id: 'notifDigest', label: 'Weekly digest', sub: 'New rides out of your city', on: false },
  ] },
  { group: 'Privacy', items: [
    { id: 'privProfile', label: 'Show my rides on my profile', sub: 'Riders you know can see where you have been', on: true },
    { id: 'privDiscoverable', label: 'Discoverable by past riders', sub: 'People you have ridden with can find you', on: true },
  ] },
]

const DEFAULTS = Object.fromEntries(TOGGLES.flatMap((g) => g.items.map((i) => [i.id, i.on])))

export default function Settings({ onClose }) {
  const { profile, signOut: authSignOut } = useAuth()
  const [shown, setShown] = useState(false)
  const [prefs, setPrefs] = useState(DEFAULTS)
  const [verified, setVerified] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const panelRef = useRef(null)
  const closed = useRef(false)

  // Load persisted prefs on the client (static export has no storage at build).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
      setPrefs({ ...DEFAULTS, ...saved })
      setVerified(localStorage.getItem(VERIFIED_KEY) === '1')
    } catch {}
  }, [])

  // Rise on the frame after mount so the slide has a "from" to animate out of.
  useEffect(() => {
    panelRef.current?.getBoundingClientRect()
    setShown(true)
  }, [])

  // Lock the page behind the panel.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const dismiss = useCallback(() => {
    if (closed.current) return
    closed.current = true
    setShown(false)
    setTimeout(onClose, 320) // matches the CSS exit; backstop if transitionend misses
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss])

  const toggle = (id) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const signOut = () => {
    try {
      localStorage.removeItem(PREFS_KEY)
      localStorage.removeItem(VERIFIED_KEY)
    } catch {}
    authSignOut() // ends the Supabase session → AuthGate shows the sign-in door
    setSignedOut(true)
  }

  const onTransitionEnd = (e) => {
    if (e.propertyName === 'transform' && e.target === panelRef.current && closed.current) onClose()
  }

  return createPortal(
    <div className={styles.scrim} data-shown={shown} onClick={dismiss}>
      <div
        ref={panelRef}
        className={styles.panel}
        data-shown={shown}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className={styles.bar}>
          <h1>Settings</h1>
          <button className={styles.close} onClick={dismiss} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {signedOut ? (
          <div className={styles.signedOut}>
            <div className={styles.signedTick}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Signed out</h2>
            <p>Your saved preferences and organiser verification on this device have been cleared.</p>
            <button className="cta" onClick={dismiss}>Done</button>
          </div>
        ) : (
          <div className={styles.body}>
            {/* Account — the facts Zurvo holds about you, stated plainly */}
            <p className={`sec-label ${styles.groupLabel}`}>Account</p>
            <div className={styles.rows}>
              <Row label="Name" value={profile?.name || 'Rider'} />
              <Row label="Home city" value={profile?.city || 'Not set'} valueTone={profile?.city ? undefined : 'muted'} />
              <Row
                label="Organiser status"
                value={verified ? 'Verified ✓' : 'Not verified'}
                valueTone={verified ? 'safe' : 'muted'}
              />
            </div>

            {/* the working part: toggles that persist */}
            {TOGGLES.map((g) => (
              <div key={g.group}>
                <p className={`sec-label ${styles.groupLabel}`}>{g.group}</p>
                <div className={styles.rows}>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      className={styles.toggleRow}
                      role="switch"
                      aria-checked={prefs[it.id]}
                      onClick={() => toggle(it.id)}
                    >
                      <span className={styles.toggleText}>
                        <b>{it.label}</b>
                        <em>{it.sub}</em>
                      </span>
                      <span className={styles.switch} data-on={prefs[it.id]} aria-hidden="true">
                        <span className={styles.knob} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <p className={`sec-label ${styles.groupLabel}`}>Support</p>
            <div className={styles.rows}>
              <LinkRow label="Help centre" />
              <LinkRow label="Terms of service" />
              <LinkRow label="Privacy policy" />
            </div>

            <button className={styles.signOut} onClick={signOut}>
              Sign out
            </button>
            <p className={styles.version}>Zurvo · v0.1.0</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Row({ label, value, valueTone }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue} data-tone={valueTone}>
        {value}
      </span>
    </div>
  )
}

/* An honest dead-end: it looks tappable and gives feedback, but it does not
   pretend to open a page that does not exist. */
function LinkRow({ label }) {
  return (
    <button className={styles.linkRow}>
      <span>{label}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="m5 3 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
