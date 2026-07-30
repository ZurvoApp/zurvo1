'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { CITIES } from '@/lib/data'
import { getCityCounts } from '@/lib/api'
import { copy } from '@/lib/verticals'
import styles from './topbar.module.css'

/* City on the left, rider on the right. Both are identity, not navigation:
   which city's rides you see, and who you are while seeing them.

   `hasHere` (live count in the current city) is passed by the parent, which
   already loaded the feed — no reason for the bar to query it a second time. */
export default function TopBar({ city, onCity, vertical = 'rides', title, hasHere = false }) {
  const [picking, setPicking] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const cityBtn = useRef(null)

  const anyHere = hasHere

  // "Get the app" belongs to browser users on a phone who haven't installed yet.
  // Hidden once running as the installed PWA, and on desktop (CSS) where the
  // sign-in page's QR covers it instead.
  const [showGetApp, setShowGetApp] = useState(false)
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setShowGetApp(!standalone)
  }, [])

  const open = () => {
    setAnchor(cityBtn.current.getBoundingClientRect())
    setPicking(true)
  }

  return (
    <>
      <div className={styles.bar}>
        {title ? (
          <h1 className={styles.title}>{title}</h1>
        ) : (
          <button
            ref={cityBtn}
            className={styles.city}
            data-open={picking}
            onClick={open}
            aria-haspopup="dialog"
            aria-expanded={picking}
          >
            {/* the dot is live rides in this city right now — it earns its pixel */}
            <span className={styles.dot} data-live={anyHere} />
            {city}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M3 4.5 5.5 7 8 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className={styles.right}>
          {/* Phone-only install shortcut; hidden in the installed app and on desktop. */}
          {showGetApp && (
            <Link href="/get/" className={styles.getApp}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Get the app
            </Link>
          )}
          {/* Profile lives in the bottom nav ("Me"); the bar keeps the one shortcut
              worth a thumb up here: the rides he has already paid for. */}
          {!title && (
            <Link href="/rides/" className={styles.icon} aria-label="My rides">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <rect x="2.5" y="3.5" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2.5 7h13M6 2.2v2.6M12 2.2v2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {picking && anchor && (
        <CityMenu
          anchor={anchor}
          city={city}
          vertical={vertical}
          onPick={onCity}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

const MENU_W = 238

/* A glass dropdown pinned under the city button — not a sheet. It owns its own
   exit: the parent unmounts it only after the fade has finished, so closing is a
   movement, not a cut. */
function CityMenu({ anchor, city, vertical, onPick, onClose }) {
  const [shown, setShown] = useState(false)
  const panelRef = useRef(null)
  const closed = useRef(false)

  const c = copy(vertical)

  /* Cities you can actually ride out of, and cities that would hand you an empty
     screen. The counts come from the database; until they arrive every city is
     assumed empty, which is also the correct resting state for a fresh app. */
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let live = true
    getCityCounts(vertical)
      .then((c) => live && setCounts(c))
      .catch(() => live && setCounts({}))
    return () => {
      live = false
    }
  }, [vertical])

  const [live, dead] = useMemo(() => {
    const counted = CITIES.map((name) => ({ name, n: counts?.[name] ?? 0 }))
    return [
      counted.filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
      counted.filter((x) => x.n === 0).sort((a, b) => a.name.localeCompare(b.name)),
    ]
  }, [counts])

  /* Commit the hidden state before flipping to shown, so the transition has a
     "from" to animate out of. A forced reflow does this deterministically —
     requestAnimationFrame would too, but rAF is throttled in background and
     headless tabs, which turns the entrance into a delayed pop. */
  useEffect(() => {
    panelRef.current?.getBoundingClientRect()
    setShown(true)
  }, [])

  // The anchor rect was measured at open — the page must not scroll out from under it.
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
    // transitionend does the unmount; this is only the backstop if it never fires.
    setTimeout(onClose, 300)
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
        return
      }
      // Tab must not walk out of the menu into the page it is floating over.
      if (e.key !== 'Tab') return
      const rows = panelRef.current?.querySelectorAll('button')
      if (!rows?.length) return
      const first = rows[0]
      const last = rows[rows.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss])

  // Land the keyboard on the city you are already in, and scroll it into view —
  // it may be down in the empty group.
  useEffect(() => {
    panelRef.current?.querySelector('[aria-current="true"]')?.focus()
  }, [])

  const pick = (name) => {
    onPick(name)
    dismiss()
  }

  const onTransitionEnd = (e) => {
    if (e.propertyName === 'opacity' && e.target === panelRef.current && closed.current) onClose()
  }

  // Pin to the button, but never off the right edge of a narrow screen.
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - MENU_W - 12))
  const top = anchor.bottom + 8

  /* Portalled to <body> on purpose. The header this button lives in has a
     backdrop-filter, which makes it the containing block for position:fixed
     children — the menu would anchor to the header and get clipped to it
     instead of floating over the page. Same trap template.module.css warns about. */
  return createPortal(
    <div className={styles.scrim} onClick={dismiss}>
      <div
        ref={panelRef}
        className={styles.menu}
        data-shown={shown}
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-label="Choose city"
      >
        <p className={`sec-label ${styles.menuLabel}`}>{c.plural} near</p>

        <ul className={styles.cities}>
          {live.map((x, i) => (
            <Row key={x.name} {...x} c={c} i={i} current={x.name === city} onPick={pick} />
          ))}
        </ul>

        {dead.length > 0 && (
          <>
            <p className={`sec-label ${styles.deadLabel}`}>Nothing yet</p>
            <ul className={styles.cities}>
              {dead.map((x, i) => (
                <Row
                  key={x.name}
                  {...x}
                  c={c}
                  i={live.length + i}
                  current={x.name === city}
                  onPick={pick}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Row({ name, n, c, i, current, onPick }) {
  return (
    <li style={{ '--i': i }}>
      <button onClick={() => onPick(name)} aria-current={current} data-empty={n === 0}>
        <span className={styles.name}>{name}</span>
        <span className={`${styles.count} mono`}>{n > 0 ? n : '—'}</span>
        <span className={styles.check} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 7.4 5.8 10 11 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </li>
  )
}
