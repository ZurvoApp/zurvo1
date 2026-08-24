'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Reveal from '@/components/Reveal'
import { CoverImage } from '@/components/CoverImage'
import { EscrowBlock, Faces, Organiser, Seats } from '@/components/Trust'
import { bookTrip } from '@/lib/api'
import { knownRiders, rupees, seatsLeft } from '@/lib/data'
import styles from './trip.module.css'

/* The order of this page is not a layout decision. It is the sequence of doubt:
     1. who is taking my money
     2. who am I riding with
     3. what will it actually be like
     4. what happens if it goes wrong
   Trust is placed exactly where the doubt lands. */
export default function TripDetail({ trip }) {
  const router = useRouter()
  const [showCovers, setShowCovers] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const scroller = useRef(null)
  const hero = useRef(null)
  const known = knownRiders(trip)
  const listed = trip.riders.slice(0, 3)
  const rest = trip.riders.length - listed.length

  /* The seat is taken HERE, before the confirmation screen renders — that screen
     reads a booking, it does not create one. Navigating first and writing later
     is how you end up congratulating someone for a seat that was already gone. */
  const join = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      await bookTrip(trip.id)
      router.push(`/booking/${trip.id}/`)
    } catch (e) {
      // book_trip raises in plain English — full, closed, not signed in — so the
      // rider gets the actual reason instead of "something went wrong".
      setJoinError(e?.message || 'That didn’t go through. Try again.')
      setJoining(false)
    }
  }

  useEffect(() => {
    document.documentElement.dataset.vertical = trip.vertical
  }, [trip.vertical])

  /* The hero drifts at a third of scroll speed. Depth is what separates a page
     that scrolls from a page that feels like a surface moving over another. */
  useEffect(() => {
    const el = scroller.current
    const img = hero.current
    if (!el || !img) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        const y = el.scrollTop
        img.style.transform = `translate3d(0, ${y * 0.34}px, 0) scale(${1 + Math.min(y, 200) * 0.0004})`
        frame = 0
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div className={styles.scroller} ref={scroller}>
        <div className={styles.photo}>
          <CoverImage photo={trip.photo} title={trip.title} ref={hero} fetchPriority="high" decoding="async" />
          <div className={styles.scrim} />
          <button className={styles.back} onClick={() => router.back()} aria-label="Back">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M9.5 3 5 7.5 9.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.sheet}>
          {/* He tapped a promise. The top of this page repays it identically. */}
          <Reveal as="h1" i={0} className="ride-title" style={{ fontSize: 23 }}>
            {trip.title}
          </Reveal>
          <Reveal as="p" i={1} className="facts">
            <b>{trip.dates}</b> · <b>{trip.distanceKm} km</b> · <b>{trip.difficulty}</b>
          </Reveal>

          <div className="rule" />

          {/* DOUBT 1 — who is taking my money */}
          <Reveal i={2}>
            <Organiser organiser={trip.organiser} detailed />
            <a className="link" href={`sms:?body=About ${trip.title}`}>
              Message {trip.organiser.name.split(' ')[0]} before you decide
            </a>
          </Reveal>

          <div className="rule" />

          {/* DOUBT 2 — who am I riding with */}
          <Reveal as="section" className={styles.block}>
            <p className="sec-label">
              {trip.riders.length} riders going · {seatsLeft(trip)} seats left
            </p>
            <ul className={styles.riders}>
              {listed.map((r) => (
                <li key={r.id}>
                  <span className={'face' + (r.knownToMe ? ' known' : '')} style={{ background: r.tint, marginRight: 0 }}>
                    {r.name[0]}
                  </span>
                  <b>{r.name}</b>
                  <span className={styles.bike}>{r.bike}</span>
                  {r.knownToMe && <em className={styles.rodeWith}>RODE WITH YOU</em>}
                </li>
              ))}
              {rest > 0 && (
                <li>
                  <Faces riders={trip.riders.slice(3)} max={1} />
                  <span className={styles.bike} style={{ fontFamily: 'var(--body)', fontSize: 12.5 }}>
                    {rest} more riders
                  </span>
                </li>
              )}
            </ul>
            <Link className="link" href={`/trip/${trip.id}/group/`}>
              Message the group before you book
            </Link>
          </Reveal>

          <div className="rule" />

          {/* DOUBT 3 — what will it actually be like. He wants to picture the ride,
              not navigate it. Four lines do that; a map embed does not.
              The stops arrive one at a time, so the route reads as a journey
              being traced rather than a list being printed. */}
          <Reveal as="section" className={styles.block}>
            <p className="sec-label">The route</p>
            <ol className={styles.route}>
              {trip.route.map((s, i) => (
                <li
                  key={i}
                  className={s.kind ? styles[s.kind] : undefined}
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <i />
                  <span>{s.place}</span>
                  <time>{s.when}</time>
                </li>
              ))}
            </ol>
          </Reveal>

          <div className="rule" />

          {/* Justifies the number the instant before he reads it. */}
          <Reveal>
            <button className={styles.covers} onClick={() => setShowCovers((v) => !v)} aria-expanded={showCovers}>
              <span>
                {rupees(trip.price)} covers <b>{trip.covers}</b>
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  transform: showCovers ? 'rotate(90deg)' : 'none',
                  transition: 'transform var(--t-base) var(--ease)',
                }}
              >
                <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className={styles.coversWrap} data-open={showCovers}>
              <ul className={styles.coversFull}>
                {trip.coversFull.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* DOUBT 4 — sits physically between the price and the button, on purpose. */}
          <Reveal>
            <EscrowBlock trip={trip} />
            <Seats trip={trip} />
            {known.length > 0 && (
              <p className={styles.reassure}>
                You won&apos;t be riding with strangers — {known.map((r) => r.name).join(' and ')}{' '}
                {known.length > 1 ? 'have' : 'has'} ridden with you before.
              </p>
            )}
          </Reveal>
        </div>
      </div>

      {/* One button. "Request", not "Book" — it is honest about approval. */}
      <footer className={styles.footer}>
        <div className="price">
          {rupees(trip.price)}
          {trip.price > 0 && (
            <small>
              <br />
              per rider
            </small>
          )}
        </div>
        <button className="cta" onClick={join} disabled={joining}>
          {joining ? 'Holding your seat…' : 'Request to join'}
        </button>
      </footer>
      {joinError && <p className={styles.joinError}>{joinError}</p>}
    </>
  )
}
