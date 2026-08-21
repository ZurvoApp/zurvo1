'use client'

import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import ModeSwitch from '@/components/ModeSwitch'
import Reveal from '@/components/Reveal'
import { Lock } from '@/components/Trust'
import { CITIES, rupees } from '@/lib/data'
import { createTrip } from '@/lib/api'
import { copy, VERTICAL_LIST } from '@/lib/verticals'
import styles from './create.module.css'

/* The supply side of the app. Everything a rider is promised on the way IN —
   verified organiser, money in escrow, real seat counts — is a bill that somebody
   has to pay HERE. So this screen states the terms before it asks for a single
   field: you get paid 24h after they finish, and not one minute earlier.

   It asks for exactly the facts a trip card renders. If a field would not appear
   on a card or a trip page, it is not on this form. */
const BLANK = {
  title: '',
  city: CITIES[0],
  dates: '',
  days: '',
  distanceKm: '',
  difficulty: 'Beginner',
  seatsTotal: '',
  price: '',
  covers: '',
}

/* Organiser onboarding is FREE for now — no ID-verification fee while Zurvo is
   signing up its first organisers. Set ORG_FEE back to 99 to turn the paid
   one-time verification on again: the Verify screen and the localStorage gate
   both branch on CHARGE_FOR_VERIFY, so flipping this one number restores the
   whole paid flow. */
const ORG_FEE = 0
const CHARGE_FOR_VERIFY = ORG_FEE > 0
const VERIFIED_KEY = 'zurvo:organiser-verified'

export default function Create() {
  const [vertical, setVertical] = useState('rides')
  const [f, setF] = useState(BLANK)
  const [stage, setStage] = useState('form') // 'form' | 'verify' | 'published'
  const [verified, setVerified] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [created, setCreated] = useState(null)
  const [error, setError] = useState(null)

  // Read on the client only — a static export has no localStorage at build time,
  // and reading during render would mismatch the server-rendered HTML.
  useEffect(() => {
    try {
      setVerified(localStorage.getItem(VERIFIED_KEY) === '1')
    } catch {}
  }, [])

  /* The verticals row is gone from organiser mode, so nothing else sets the
     document accent here — the chosen trip type has to drive it directly, or the
     whole form would stay stuck on whatever colour Discover was last showing. */
  useEffect(() => {
    document.documentElement.dataset.vertical = vertical
  }, [vertical])

  const c = copy(vertical)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  /* Difficulty is per-vertical vocabulary, not a shared scale — a Paddle is
     Flatwater/Coastal/Whitewater, never "Beginner". Switching worlds must carry the
     grade over to the new scale, or the form keeps a value no chip can show. */
  const switchVertical = (v) => {
    setVertical(v)
    setF((prev) => ({ ...prev, difficulty: copy(v).difficulty[0] }))
  }

  // Every field is load-bearing on a card, so every field is required.
  const ready = Object.values(f).every((v) => String(v).trim() !== '')

  /* Insert the trip and only then show the published screen — the trip that
     screen celebrates is the row that actually landed in the database, not the
     form. If the insert fails, stay on the form with the reason. */
  const publish = async () => {
    setPublishing(true)
    setError(null)
    try {
      const trip = await createTrip({ ...f, vertical })
      setCreated(trip)
      setStage('published')
    } catch (e) {
      setError(e?.message || 'Could not publish. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  // While onboarding is free, publishing goes straight live. With the fee on, an
  // unverified organiser routes through the one-time verification first.
  const onPublish = () => (!CHARGE_FOR_VERIFY || verified ? publish() : setStage('verify'))

  const onVerified = () => {
    try {
      localStorage.setItem(VERIFIED_KEY, '1')
    } catch {}
    setVerified(true)
    publish()
  }

  if (stage === 'published')
    return (
      <Published
        trip={created ?? { ...f, vertical }}
        vertical={vertical}
        onAgain={() => {
          setF(BLANK)
          setCreated(null)
          setStage('form')
        }}
      />
    )

  if (stage === 'verify')
    return <Verify vertical={vertical} onPaid={onVerified} onBack={() => setStage('form')} />

  return (
    <>
      <header className={styles.head}>
        <TopBar title={`Run a ${c.noun}`} />
        <ModeSwitch active="organiser" />
      </header>

      <main className={styles.wrap}>
        {/* Type first — it decides every noun on the rest of this screen, so it
            cannot come after the copy that depends on it. */}
        <Reveal i={0}>
          <Field label="What are you running?">
            <div className={styles.typeChips} role="radiogroup" aria-label="Trip type">
              {VERTICAL_LIST.map((v) => (
                <button
                  key={v.id}
                  role="radio"
                  aria-checked={vertical === v.id}
                  className={styles.typeChip}
                  onClick={() => switchVertical(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </Field>
        </Reveal>

        {/* The terms, before the form. He is about to take other people's money. */}
        <Reveal i={1} className="escrow-block" style={{ marginTop: 18 }}>
          <Lock size={15} />
          <p>
            <b>Riders pay Zurvo, not you.</b>
            <em>
              We hold every rupee until 24h after the {c.noun} finishes. Cancel on them and it goes straight
              back — which is exactly why they will book you.
            </em>
          </p>
        </Reveal>

        <Reveal as="p" i={2} className="sec-label" style={{ marginTop: 26 }}>
          The {c.noun}
        </Reveal>

        <Reveal i={3}>
          <Field label="Call it something they can picture">
            <input
              value={f.title}
              onChange={set('title')}
              placeholder={c.id === 'trails' ? 'Kudremukh summit, above the clouds' : 'Bangalore to Ooty, the long way'}
              maxLength={54}
            />
          </Field>
        </Reveal>

        <Reveal i={4}>
          <div className={styles.pair}>
            <Field label="Starts from">
              <select value={f.city} onChange={set('city')}>
                {CITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Dates">
              <input value={f.dates} onChange={set('dates')} placeholder="14–16 Aug" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={5}>
          <div className={styles.pair}>
            <Field label="Days">
              <input value={f.days} onChange={set('days')} inputMode="numeric" placeholder="3" />
            </Field>
            <Field label="Distance (km)">
              <input value={f.distanceKm} onChange={set('distanceKm')} inputMode="numeric" placeholder="350" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={6}>
          <Field label="How hard is it, honestly">
            <div className={styles.chips} role="radiogroup" aria-label="Difficulty">
              {c.difficulty.map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={f.difficulty === d}
                  className={styles.chip}
                  onClick={() => setF({ ...f, difficulty: d })}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </Reveal>

        <Reveal as="p" i={7} className="sec-label" style={{ marginTop: 26 }}>
          The seats
        </Reveal>

        <Reveal i={8}>
          <div className={styles.pair}>
            <Field label={`${c.seats[0].toUpperCase() + c.seats.slice(1)} on offer`}>
              <input value={f.seatsTotal} onChange={set('seatsTotal')} inputMode="numeric" placeholder="12" />
            </Field>
            <Field label="Price per rider (₹)">
              <input value={f.price} onChange={set('price')} inputMode="numeric" placeholder="4800" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={9}>
          {/* A rider decides on this line more than on the price. */}
          <Field label="What the price covers" hint="Say what it does NOT cover too. Surprises on the road are how organisers lose their rating.">
            <input value={f.covers} onChange={set('covers')} placeholder="stay, 2 dinners, backup van — fuel is on you" />
          </Field>
        </Reveal>

        <Reveal i={10} className={styles.foot}>
          <button className="cta" disabled={!ready || publishing} data-busy={publishing} onClick={onPublish}>
            {publishing ? (
              <>
                <span className={styles.spin} aria-hidden="true" />
                Publishing…
              </>
            ) : ready ? (
              `Publish this ${c.noun}`
            ) : (
              'Fill every field to publish'
            )}
          </button>
          {error && <p className={styles.publishError}>{error}</p>}
          <p className={styles.footNote}>
            {!CHARGE_FOR_VERIFY ? (
              <>
                <span className={styles.verifiedInline}>Free to publish right now.</span> No organiser fee while
                Zurvo is getting started — and riders’ payments are always yours in full.
              </>
            ) : verified ? (
              <>
                <span className={styles.verifiedInline}>✓ You’re a verified organiser.</span> Nothing stands
                between this and going live.
              </>
            ) : (
              <>
                First time? Publishing includes a one-time <b>{rupees(ORG_FEE)}</b> ID verification — the only
                fee Zurvo ever charges you. Riders’ payments are yours in full.
              </>
            )}
          </p>
        </Reveal>
      </main>

      <BottomNav current="discover" />
    </>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <em className={styles.hint}>{hint}</em>}
    </label>
  )
}

/* The one-time gate. It is not a paywall in front of the product — the organiser
   has already built his ride by the time he lands here, so the ask is small and
   the reason is the same trust the whole app is selling: riders will only hand
   money to someone Zurvo has checked. */
function Verify({ vertical, onPaid, onBack }) {
  const c = copy(vertical)
  const [paying, setPaying] = useState(false)

  const pay = () => {
    setPaying(true)
    // Mock the processor round-trip — there is no payment backend in the prototype.
    setTimeout(onPaid, 1500)
  }

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Get verified" />
      </header>

      <main className={styles.wrap}>
        <Reveal i={0} className={styles.verifyHead}>
          <span className={styles.shield}>
            <Lock size={22} />
          </span>
          <h1 className="ride-title">One check before your first {c.noun} goes live.</h1>
          <p>
            Zurvo verifies every organiser’s ID, so riders are never handing money to a stranger. It costs{' '}
            {rupees(ORG_FEE)}, once — and it is the only money Zurvo will ever take from you.
          </p>
        </Reveal>

        <Reveal i={1}>
          <ul className={styles.perks}>
            <li>A verified badge on every {c.noun} you run</li>
            <li>Riders’ payments held in escrow, released to you 24h after each trip</li>
            <li>You keep 100% of what riders pay — Zurvo takes no cut of the fare</li>
          </ul>
        </Reveal>

        <Reveal i={2} className={styles.feeCard}>
          <div>
            <strong>Organiser verification</strong>
            <em>One-time · you’ll never see this again</em>
          </div>
          <b className={`mono ${styles.feeAmount}`}>{rupees(ORG_FEE)}</b>
        </Reveal>

        <Reveal i={3} className={styles.foot}>
          <button className="cta" onClick={pay} disabled={paying} data-busy={paying}>
            {paying ? (
              <>
                <span className={styles.spin} aria-hidden="true" />
                Verifying…
              </>
            ) : (
              `Pay ${rupees(ORG_FEE)} & verify`
            )}
          </button>
          <button className="link" onClick={onBack} disabled={paying} style={{ display: 'block', margin: '0 auto' }}>
            Back to my {c.noun}
          </button>
        </Reveal>
      </main>

      <BottomNav current="discover" />
    </>
  )
}

/* Publishing is not a toast. It is the moment he becomes responsible for other
   people's money and other people's weekend — so it takes the whole screen. */
function Published({ trip, vertical, onAgain }) {
  const c = copy(vertical)
  const seats = Number(trip.seatsTotal) || 0
  const price = Number(trip.price) || 0

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Published" />
      </header>

      <main className={styles.wrap}>
        <Reveal i={0} className={styles.done}>
          <span className={styles.tickBig}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="m5 12.5 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="ride-title">{trip.title}</h1>
          <p className="facts">
            <b>{trip.dates}</b> · <b>{trip.days} days</b> · <b>{trip.distanceKm} km</b> · <b>{trip.difficulty}</b>
          </p>
        </Reveal>

        <Reveal i={1} className="escrow-block" style={{ marginTop: 18 }}>
          <Lock size={15} />
          <p>
            <b>
              {rupees(price * seats)} is the most this {c.noun} can hold
            </b>
            <em>
              {seats} {c.seats} × {rupees(price)}. Every rupee sits with Zurvo until 24h after you finish.
            </em>
          </p>
        </Reveal>

        <Reveal as="p" i={2} className={styles.next}>
          It goes live to riders in {trip.city} the moment your ID clears — usually within a day. We will tell
          you the second someone books.
        </Reveal>

        <Reveal i={3} className={styles.foot}>
          <button className="cta" onClick={onAgain}>
            Run another {c.noun}
          </button>
        </Reveal>
      </main>

      <BottomNav current="discover" />
    </>
  )
}
