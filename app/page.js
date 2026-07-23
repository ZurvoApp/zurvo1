'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import ModeSwitch from '@/components/ModeSwitch'
import VerticalTabs from '@/components/VerticalTabs'
import Reveal from '@/components/Reveal'
import { TripCard, TripRow } from '@/components/TripCard'
import { Faces, KnownRiders, Lock, Organiser, PriceWithEscrow, Seats } from '@/components/Trust'
import { knownRiders, showScarcity } from '@/lib/data'
import { getTrips, getOrganisers } from '@/lib/api'
import { copy } from '@/lib/verticals'
import styles from './home.module.css'

/* HOME.
   It scales by adding SECTIONS, never by adding things to a card. Each section
   answers one question a rider actually asks, in the order he asks it:
     what should I do next → who do I know → what's running out → can I trust you
   A card that tried to answer all four at once is the design we deleted. */
export default function Home() {
  const [vertical, setVertical] = useState('rides')
  const [city, setCity] = useState('Bangalore')
  const [trips, setTrips] = useState(null) // null = loading, [] = loaded-empty
  const [organisers, setOrganisers] = useState([])

  const c = copy(vertical)

  /* Load the feed whenever the world or city changes. The guard drops a stale
     response if the user switched again before it arrived, so a slow request for
     the old vertical can never overwrite the new one. */
  useEffect(() => {
    let live = true
    setTrips(null)
    window.scrollTo(0, 0)
    Promise.all([getTrips({ vertical, city }), getOrganisers({ vertical, city })])
      .then(([t, o]) => {
        if (!live) return
        setTrips(t)
        setOrganisers(o)
      })
      .catch(() => live && setTrips([]))
    return () => {
      live = false
    }
  }, [vertical, city])

  /* A trip may appear in the hero OR in exactly one rail — never both.
     Showing the same ride four times down one screen is the clutter we deleted,
     just spread out instead of stacked. The index at the bottom is the one place
     everything is allowed to appear, because that is what an index is for. */
  const loading = trips === null
  const list = trips ?? []
  const hero = list[0]
  const rest = list.slice(1)
  const known = rest.filter((t) => knownRiders(t).length > 0)
  const claimed = new Set(known.map((t) => t.id))
  const filling = rest.filter((t) => showScarcity(t) && !claimed.has(t.id))

  return (
    <>
      <header className={styles.head}>
        <TopBar city={city} onCity={setCity} vertical={vertical} hasHere={list.length > 0} />
        <ModeSwitch active="rider" />
        <VerticalTabs active={vertical} onChange={setVertical} />
      </header>

      <main className={styles.scroll} key={`${vertical}-${city}`}>
        {loading ? (
          <div className={styles.loading} aria-live="polite" aria-busy="true">
            <span className={styles.spinner} />
          </div>
        ) : !hero ? (
          <Empty city={city} vertical={vertical} />
        ) : (
          <>
            {/* ONE ride, full trust, no competition. The rest of the page is a
                menu; this is a recommendation. */}
            <Hero trip={hero} />

            {known.length > 0 && (
              <Rail
                title={`${known.length === 1 ? 'A rider' : 'Riders'} you know`}
                note="The fastest way to stop riding with strangers"
                trips={known}
              />
            )}

            {filling.length > 0 && (
              <Rail title="Filling up" note="Real seats, real count — nothing here is manufactured" trips={filling} wide />
            )}

            {/* how escrow works, stated once, where he can't miss it */}
            <Reveal as="section" className={styles.trust}>
              <div className={styles.trustHead}>
                <Lock size={14} />
                <h2>Your money is never with a stranger</h2>
              </div>
              <ol className={styles.steps}>
                <li>
                  <span className="mono">01</span>
                  <div>
                    <b>You pay Zurvo</b>
                    <em>Not the organiser</em>
                  </div>
                </li>
                <li>
                  <span className="mono">02</span>
                  <div>
                    <b>We hold it</b>
                    <em>Cancel free, get it all back</em>
                  </div>
                </li>
                <li>
                  <span className="mono">03</span>
                  <div>
                    <b>They get paid</b>
                    <em>24h after you finish</em>
                  </div>
                </li>
              </ol>
            </Reveal>

            {/* the people you'd be handing money to */}
            {organisers.length > 0 && (
              <Reveal as="section" className={styles.section}>
                <SectionHead title="Organisers near you" note="Every one of them is ID verified" />
                <div className={styles.rail}>
                  {organisers.map((o) => (
                    <div key={o.id} className={styles.org}>
                      <div className={styles.orgAv}>{o.initials}</div>
                      <b>{o.name}</b>
                      <span className="mono">
                        {o.ridesHosted} hosted · ★{o.rating}
                      </span>
                      <span className={styles.orgTrips}>
                        {o.tripCount} {o.tripCount === 1 ? c.noun : c.plural} open
                      </span>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}

            {/* everything, once he has decided he wants to browse rather than be told */}
            <Reveal as="section" className={styles.section}>
              <SectionHead
                title={`All ${c.plural} from ${city}`}
                note={`${trips.length} open right now`}
              />
              <div className={styles.list}>
                {trips.map((t) => (
                  <TripRow key={t.id} trip={t} />
                ))}
              </div>
            </Reveal>

            <Reveal as="section" className={styles.host}>
              <h2>Run your own {c.plural}?</h2>
              <p>Zurvo handles the money, the vetting and the no-shows. You handle the road.</p>
              <Link href="/create/" className="cta">
                Become an organiser
              </Link>
            </Reveal>
          </>
        )}
      </main>

      <BottomNav current="discover" />
    </>
  )
}

/* The hero keeps the rule we agreed: one ride, one screen's worth of attention,
   one button. Everything below it is a rail, not a competitor. */
function Hero({ trip }) {
  const ref = useRef(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setLive(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLive(true), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  let n = 0
  const step = (cls = '') => ({
    className: `${cls} reveal${live ? ' in' : ''}`.trim(),
    style: { '--i': n++ },
  })

  return (
    <section ref={ref} className={`${styles.hero} ${live ? styles.live : ''}`}>
      <div className={styles.heroPhoto}>
        {/* the hero is the LCP element — it fetches first and decodes off-thread */}
        <img src={trip.photo} alt="" fetchPriority="high" decoding="async" />
        <div className={styles.heroScrim} />
        <span className={styles.pick}>PICKED FOR YOU</span>
      </div>

      <div className={styles.heroSheet}>
        <h1 {...step('ride-title')}>{trip.title}</h1>
        <p {...step('facts')}>
          <b>
            {trip.days} {trip.days === 1 ? 'day' : 'days'}
          </b>{' '}
          · <b>{trip.distanceKm} km</b> · <b>{trip.difficulty}</b>
        </p>

        <div {...step()}>
          <div className="rule" />
          <KnownRiders trip={trip} />
          <div className="rule" />
        </div>

        <div {...step()}>
          <Organiser organiser={trip.organiser} />
        </div>

        <div {...step()}>
          <PriceWithEscrow trip={trip} />
          <Seats trip={trip} live={live} />
        </div>

        <Link href={`/trip/${trip.id}/`} {...step('cta')}>
          See this {copy(trip.vertical).noun}
        </Link>
      </div>
    </section>
  )
}

function SectionHead({ title, note }) {
  return (
    <div className={styles.sectionHead}>
      <h2>{title}</h2>
      {note && <p>{note}</p>}
    </div>
  )
}

function Rail({ title, note, trips, wide }) {
  return (
    <Reveal as="section" className={styles.section}>
      <SectionHead title={title} note={note} />
      <div className={styles.rail}>
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} wide={wide} />
        ))}
      </div>
    </Reveal>
  )
}

function Empty({ city, vertical }) {
  const c = copy(vertical)
  return (
    <div className={styles.empty}>
      <p className="sec-label">{city}</p>
      <h1 className="ride-title">
        No {c.plural} out of {city} yet.
      </h1>
      <p className={styles.emptyBody}>
        Every {c.noun} here is run by a verified organiser and paid through escrow. We&apos;d rather show you nothing
        than show you something we can&apos;t stand behind.
      </p>
      <button className="cta">Tell me when one opens</button>
    </div>
  )
}
