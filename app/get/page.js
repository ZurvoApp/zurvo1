'use client'

import { useEffect, useRef, useState } from 'react'
import Reveal from '@/components/Reveal'
import styles from './get.module.css'

/* THE FRONT DOOR FOR PEOPLE WHO DON'T HAVE THE APP YET.
   A public page (exempt from the auth gate) that pitches Zurvo and installs it.

   "Install" is not one button on every device — the platforms genuinely differ,
   and pretending otherwise produces a button that silently does nothing:
     • Android/Chrome : a real one-tap install prompt (needs the service worker,
                        which is why PWA.js registers one).
     • iPhone/Safari  : Apple forbids programmatic install — the honest best is to
                        show the Share -> Add to Home Screen steps.
     • Desktop        : nothing to install here; show a QR to open it on a phone.
     • Already installed: don't pitch an install — offer to open the app. */
const FEATURES = [
  {
    icon: 'shield',
    title: 'Verified organisers only',
    body: 'Every ride is run by someone Zurvo has ID-checked. No strangers leading you into the hills.',
  },
  {
    icon: 'lock',
    title: 'Your money sits in escrow',
    body: 'You pay Zurvo, not the organiser. It’s released only after you finish the ride.',
  },
  {
    icon: 'pin',
    title: 'Live map while you ride',
    body: 'See every rider on your trip move in real time — their location and speed, the whole way.',
  },
  {
    icon: 'people',
    title: 'Ride with people you know',
    body: 'See which riders you’ve ridden with before on every trip, before you commit.',
  },
]

const STATS = [
  { value: 2400, suffix: '+', label: 'riders on the road' },
  { value: 180, suffix: '', label: 'routes across India' },
  { value: 100, suffix: '%', label: 'paid through escrow' },
]

const ESCROW = [
  { n: '01', head: 'You pay Zurvo', sub: 'Never the organiser directly' },
  { n: '02', head: 'We hold it safe', sub: 'Cancel free, get it all back' },
  { n: '03', head: 'They get paid', sub: '24h after you finish the ride' },
]

export default function GetApp() {
  // mode drives which install action shows. null = still detecting.
  const [mode, setMode] = useState(null) // 'android-ready' | 'android-manual' | 'ios' | 'desktop' | 'installed'
  const [iosOpen, setIosOpen] = useState(false)
  const [url, setUrl] = useState('')
  const prompt = useRef(null)

  useEffect(() => {
    setUrl(window.location.origin + '/get/')

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    const ua = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isAndroid = /Android/.test(ua)

    const decide = () => {
      if (standalone) return setMode('installed')
      if (window.__zurvoInstallPrompt) {
        prompt.current = window.__zurvoInstallPrompt
        return setMode('android-ready')
      }
      if (isIOS) return setMode('ios')
      if (isAndroid) return setMode('android-manual')
      return setMode('desktop')
    }
    decide()

    // The install prompt can arrive a moment after the page loads — upgrade to the
    // one-tap state when it does.
    const onInstallable = () => {
      prompt.current = window.__zurvoInstallPrompt
      setMode((m) => (m === 'installed' ? m : 'android-ready'))
    }
    const onInstalled = () => setMode('installed')
    window.addEventListener('zurvo:installable', onInstallable)
    window.addEventListener('zurvo:installed', onInstalled)
    return () => {
      window.removeEventListener('zurvo:installable', onInstallable)
      window.removeEventListener('zurvo:installed', onInstalled)
    }
  }, [])

  const install = async () => {
    const p = prompt.current
    if (!p) return setMode('android-manual')
    p.prompt()
    const { outcome } = await p.userChoice
    prompt.current = null
    window.__zurvoInstallPrompt = null
    if (outcome === 'accepted') setMode('installed')
    else setMode('android-manual')
  }

  return (
    <main className={styles.wrap}>
      {/* ---------- cinematic hero ---------- */}
      <section className={styles.hero}>
        <div className={styles.stage}>
          {/* the hero image is the LCP element — it fetches first and decodes off-thread */}
          <picture>
            <source srcSet="/hero-ride.webp" type="image/webp" />
            <img
              className={styles.stageImg}
              src="/hero-ride.jpg"
              alt="A lone rider on a winding Himalayan mountain pass at golden hour"
              fetchPriority="high"
              decoding="async"
              width={1100}
              height={738}
            />
          </picture>
          <div className={styles.stageScrim} />
          <div className={styles.stageBrand}>
            <img className={styles.logo} src="/icon.png" alt="Zurvo" width={60} height={60} />
            <h1 className={styles.name}>Zurvo</h1>
            <p className={styles.tag}>Ride with people. Not with strangers.</p>
          </div>
        </div>

        <p className={styles.sub}>
          Group motorcycle rides across India — verified organisers, and your money held safe until you finish.
        </p>

        {/* ---------- the install area ---------- */}
        <div className={styles.cta}>
          {mode === null && (
            <div className={styles.detecting} aria-busy="true">
              <span className="auth-spinner" />
            </div>
          )}

          {mode === 'android-ready' && (
            <>
              <button className={styles.install} onClick={install}>
                <Down /> Install Zurvo
              </button>
              <span className={styles.ctaNote}>Installs straight to your home screen — no app store.</span>
            </>
          )}

          {mode === 'android-manual' && (
            <>
              <a className={styles.install} href="/?signin=1">
                Open Zurvo
              </a>
              <span className={styles.ctaNote}>
                To install: open your browser menu <b>⋮</b> and tap <b>Install app</b> (or <b>Add to Home screen</b>).
              </span>
            </>
          )}

          {mode === 'ios' && (
            <>
              <button className={styles.install} onClick={() => setIosOpen((v) => !v)}>
                <Share /> Add to Home Screen
              </button>
              {iosOpen && (
                <ol className={styles.steps}>
                  <li>
                    Tap the <b>Share</b> button <Share small /> in Safari’s toolbar
                  </li>
                  <li>
                    Scroll down and tap <b>Add to Home Screen</b>
                  </li>
                  <li>
                    Tap <b>Add</b> — Zurvo lands on your home screen
                  </li>
                </ol>
              )}
              <span className={styles.ctaNote}>iPhone installs from Safari’s Share menu.</span>
            </>
          )}

          {mode === 'desktop' && (
            <div className={styles.desktop}>
              <img
                className={styles.qr}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&bgcolor=15-16-22&color=255-255-255&data=${encodeURIComponent(url)}`}
                alt="QR code to open Zurvo on your phone"
                width={150}
                height={150}
              />
              <div>
                <p className={styles.desktopTitle}>Open this on your phone</p>
                <p className={styles.desktopBody}>
                  Zurvo is a mobile app. Scan the code, or visit this link on your Android or iPhone to install it.
                </p>
                <code className={styles.link}>{url.replace(/^https?:\/\//, '')}</code>
              </div>
            </div>
          )}

          {mode === 'installed' && (
            <>
              <a className={styles.install} href="/?signin=1">
                <Check /> Open Zurvo
              </a>
              <span className={styles.ctaNote}>Zurvo is installed on this device.</span>
            </>
          )}
        </div>
      </section>

      {/* ---------- social proof ---------- */}
      <Reveal as="section" className={styles.stats}>
        {STATS.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </Reveal>

      {/* ---------- features ---------- */}
      <section className={styles.features}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} i={i} className={styles.feature}>
            <span className={styles.fIcon} aria-hidden="true">
              <FeatureIcon name={f.icon} />
            </span>
            <div>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ---------- how escrow works ---------- */}
      <Reveal as="section" className={styles.escrow}>
        <div className={styles.escrowHead}>
          <Lock />
          <h2>Your money is never with a stranger</h2>
        </div>
        <ol className={styles.escrowSteps}>
          {ESCROW.map((e) => (
            <li key={e.n}>
              <span className="mono">{e.n}</span>
              <div>
                <b>{e.head}</b>
                <em>{e.sub}</em>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* ---------- footer ---------- */}
      <footer className={styles.foot}>
        <p>Your money is held in escrow. We never ride with people we haven’t verified.</p>
        <a href="/?signin=1">Already have an account? Open Zurvo →</a>
      </footer>
    </main>
  )
}


/* Counts up from 0 the first time it scrolls into view. */
function Stat({ value, suffix, label }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return setShown(value)

    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const dur = 1100
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur)
          const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
          setShown(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value])

  return (
    <div ref={ref} className={styles.stat}>
      <b className="mono">
        {shown.toLocaleString('en-IN')}
        {suffix}
      </b>
      <span>{label}</span>
    </div>
  )
}

/* ---------- icons ---------- */
function FeatureIcon({ name }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }
  const s = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'shield')
    return (
      <svg {...p}>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" {...s} />
        <path d="M9 12l2 2 4-4" {...s} />
      </svg>
    )
  if (name === 'lock')
    return (
      <svg {...p}>
        <rect x="5" y="10" width="14" height="10" rx="2.5" {...s} />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" {...s} />
        <path d="M12 14v3" {...s} />
      </svg>
    )
  if (name === 'pin')
    return (
      <svg {...p}>
        <path d="M12 21c4-4 6.5-7 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14 8 17 12 21Z" {...s} />
        <circle cx="12" cy="10.5" r="2.4" {...s} />
      </svg>
    )
  return (
    <svg {...p}>
      <circle cx="9" cy="8" r="3" {...s} />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...s} />
      <circle cx="17" cy="9" r="2.4" {...s} />
      <path d="M15.5 19a4.7 4.7 0 0 1 5-4.5" {...s} />
    </svg>
  )
}

function Lock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Down() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function Share({ small }) {
  const s = small ? 14 : 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={small ? { verticalAlign: 'middle' } : undefined}>
      <path d="M12 3v12M12 3 8 7m4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5 9 17.5 20 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
