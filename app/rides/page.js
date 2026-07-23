'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import Reveal from '@/components/Reveal'
import { Faces, Lock } from '@/components/Trust'
import { getMyRides } from '@/lib/api'
import { rupees } from '@/lib/data'
import styles from './rides.module.css'

/* ONE JOB: tell him where his money is and where he needs to be.
   Everything else about a booked ride can wait until he taps it. */
export default function MyRides() {
  const [data, setData] = useState(null) // null = loading

  useEffect(() => {
    let live = true
    getMyRides()
      .then((d) => live && setData(d))
      .catch(() => live && setData({ upcoming: [], past: [] }))
    return () => {
      live = false
    }
  }, [])

  const loading = data === null
  const upcoming = data?.upcoming ?? []
  const past = data?.past ?? []
  const held = upcoming.reduce((sum, b) => sum + (b.paid ?? 0), 0)
  const empty = !loading && upcoming.length === 0 && past.length === 0

  return (
    <>
      <header className={styles.head}>
        <TopBar title="My rides" />
      </header>

      <main className={styles.wrap}>
        {loading ? (
          <div className="auth-loading" style={{ minHeight: '50dvh' }}>
            <span className="auth-spinner" />
          </div>
        ) : empty ? (
          <div className={styles.empty}>
            <Lock size={22} />
            <h2>Nothing booked yet</h2>
            <p>When you join a ride, it lands here — and you can watch your money sit safely in escrow until you finish.</p>
            <Link href="/" className="cta">
              Find a ride
            </Link>
          </div>
        ) : (
          <>
            {/* The one number he opens this tab to check. */}
            <Reveal i={0} className={styles.vault}>
              <Lock size={15} />
              <div>
                <strong>{rupees(held)} held by Zurvo</strong>
                <span>
                  across {upcoming.length} booked {upcoming.length === 1 ? 'ride' : 'rides'} · released only after you
                  finish
                </span>
              </div>
            </Reveal>

            {upcoming.length > 0 && (
              <>
                <Reveal as="p" i={1} className="sec-label" style={{ marginTop: 26 }}>
                  Coming up
                </Reveal>
                {upcoming.map((b, i) => (
                  <Reveal key={b.trip?.id ?? i} i={2 + i}>
                    <UpcomingCard booking={b} />
                  </Reveal>
                ))}
              </>
            )}

            {past.length > 0 && (
              <>
                <Reveal as="p" className="sec-label" style={{ marginTop: 30 }}>
                  Finished
                </Reveal>
                {past.map((b, i) => (
                  <Reveal key={b.trip?.id ?? i}>
                    <PastCard booking={b} />
                  </Reveal>
                ))}
              </>
            )}
          </>
        )}
      </main>

      <BottomNav current="rides" />
    </>
  )
}

function UpcomingCard({ booking }) {
  const { trip, status, paid, daysAway } = booking
  const confirmed = status === 'confirmed'

  return (
    <Link href={`/trip/${trip.id}/`} className={styles.card} data-vertical={trip.vertical}>
      <img className={styles.thumb} src={trip.photo} alt="" loading="lazy" decoding="async" />

      <div className={styles.body}>
        <div className={styles.cardTop}>
          {/* status, not a badge shelf: approved, or still waiting on the organiser */}
          <span className={confirmed ? styles.ok : styles.wait}>
            {confirmed ? 'CONFIRMED' : 'AWAITING ORGANISER'}
          </span>
          <span className={styles.away}>
            {daysAway} {daysAway === 1 ? 'day' : 'days'} away
          </span>
        </div>

        <h2>{trip.title}</h2>

        <p className={styles.meet}>
          {trip.meetOn} · {trip.meetAt}
        </p>

        <div className={styles.cardFoot}>
          <Faces riders={trip.riders} max={4} />
          <span className={styles.money}>
            <Lock size={10} />
            {rupees(paid)} held
          </span>
        </div>
      </div>
    </Link>
  )
}

function PastCard({ booking }) {
  const { trip, finishedOn, reviewed } = booking
  return (
    <Link href={`/trip/${trip.id}/`} className={`${styles.card} ${styles.done}`} data-vertical={trip.vertical}>
      <img className={styles.thumb} src={trip.photo} alt="" loading="lazy" decoding="async" />
      <div className={styles.body}>
        <div className={styles.cardTop}>
          <span className={styles.finished}>FINISHED {finishedOn}</span>
        </div>
        <h2>{trip.title}</h2>
        <p className={styles.meet}>
          {trip.distanceKm} km · {trip.riders.length} riders
        </p>
        <div className={styles.cardFoot}>
          {/* the only unfinished business a past ride can have */}
          <span className={reviewed ? styles.muted : styles.nudge}>
            {reviewed ? 'You reviewed this ride' : 'Rate your organiser →'}
          </span>
        </div>
      </div>
    </Link>
  )
}
