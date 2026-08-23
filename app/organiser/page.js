'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import ModeSwitch from '@/components/ModeSwitch'
import Reveal from '@/components/Reveal'
import TripUpdates from '@/components/TripUpdates'
import { CoverImage } from '@/components/CoverImage'
import { getMyOrganisedTrips, finishTrip } from '@/lib/api'
import { rupees } from '@/lib/data'
import { copy } from '@/lib/verticals'
import styles from './organiser.module.css'

/* THE ORGANISER HUB.
   The other side of the marketplace, for the person running the rides. One screen
   answers everything they need mid-season: what's live, how full it is, how much
   Zurvo is holding for them, a channel to keep riders posted, and — when the road
   is behind them — the button that finishes the ride so everyone gets their recap.
   Past trips keep their numbers so an organiser can see how they've done. */
export default function OrganiserHub() {
  const [trips, setTrips] = useState(null) // null = loading

  const load = useCallback(() => {
    getMyOrganisedTrips()
      .then(setTrips)
      .catch(() => setTrips([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loading = trips === null
  const live = (trips ?? []).filter((t) => !t.finished)
  const past = (trips ?? []).filter((t) => t.finished)

  const totalHeld = live.reduce((s, t) => s + (t.revenueHeld || 0), 0)
  const totalRiders = (trips ?? []).reduce((s, t) => s + (t.seatsTaken || 0), 0)

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Organiser" />
        <ModeSwitch active="organiser" />
      </header>

      <main className={styles.wrap}>
        {loading ? (
          <div className="auth-loading" style={{ minHeight: '50dvh' }}>
            <span className="auth-spinner" />
          </div>
        ) : trips.length === 0 ? (
          <div className={styles.empty}>
            <h2>You haven’t run a trip yet</h2>
            <p>Publish your first ride and it shows up here — with its seats, the money held for you, and a channel to keep your riders posted.</p>
            <Link href="/create/" className="cta">
              Create a trip
            </Link>
          </div>
        ) : (
          <>
            {/* the two numbers an organiser opens this for */}
            <Reveal i={0} className={styles.summary}>
              <div>
                <b className="mono">{rupees(totalHeld)}</b>
                <span>held for you</span>
              </div>
              <div>
                <b className="mono">{totalRiders}</b>
                <span>riders total</span>
              </div>
              <div>
                <b className="mono">{live.length}</b>
                <span>live now</span>
              </div>
            </Reveal>

            <Link href="/create/" className={styles.newBtn}>
              + New trip
            </Link>

            {live.length > 0 && (
              <>
                <Reveal as="p" i={1} className="sec-label" style={{ marginTop: 24 }}>
                  Live &amp; upcoming
                </Reveal>
                {live.map((t, i) => (
                  <Reveal key={t.id} i={2 + i}>
                    <LiveTripCard trip={t} onFinished={load} />
                  </Reveal>
                ))}
              </>
            )}

            {past.length > 0 && (
              <>
                <Reveal as="p" className="sec-label" style={{ marginTop: 28 }}>
                  Finished
                </Reveal>
                {past.map((t) => (
                  <Reveal key={t.id}>
                    <PastTripCard trip={t} />
                  </Reveal>
                ))}
              </>
            )}
          </>
        )}
      </main>

      <BottomNav current="me" />
    </>
  )
}

function LiveTripCard({ trip, onFinished }) {
  const [open, setOpen] = useState(false) // the live-updates panel
  const [finishing, setFinishing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState(null)
  const c = copy(trip.vertical)
  const fill = trip.seatsTotal > 0 ? Math.round((trip.seatsTaken / trip.seatsTotal) * 100) : 0

  const finish = async () => {
    setFinishing(true)
    setError(null)
    try {
      await finishTrip(trip.id)
      onFinished()
    } catch (e) {
      setError(e?.message || 'Could not finish the trip.')
      setFinishing(false)
    }
  }

  return (
    <div className={styles.card} data-vertical={trip.vertical}>
      <div className={styles.cardTop}>
        <CoverImage photo={trip.photo} title={trip.title} className={styles.thumb} />
        <div className={styles.cardBody}>
          <h3>{trip.title}</h3>
          <p className={styles.meta}>
            {trip.dates} · {trip.city}
          </p>
          <div className={styles.statRow}>
            <span>
              <b className="mono">
                {trip.seatsTaken}/{trip.seatsTotal}
              </b>{' '}
              {c.seats}
            </span>
            <span>
              <b className="mono">{rupees(trip.revenueHeld)}</b> held
            </span>
          </div>
          <div className={styles.bar}>
            <i style={{ width: `${fill}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.action} data-on={open || undefined} onClick={() => setOpen((v) => !v)}>
          Post update
        </button>
        <Link className={styles.action} href={`/organiser/${trip.id}/edit/`}>
          Edit
        </Link>
        <button className={styles.action} data-danger onClick={() => setConfirm(true)} disabled={finishing}>
          {finishing ? 'Finishing…' : 'Mark finished'}
        </button>
      </div>

      {open && (
        <div className={styles.panel}>
          <TripUpdates tripId={trip.id} canPost />
        </div>
      )}

      {confirm && (
        <div className={styles.confirm}>
          <p>
            Finish <b>{trip.title}</b>? This closes it to new riders and drops every rider’s share card into their
            finished rides. You can’t undo it.
          </p>
          <div className={styles.confirmBtns}>
            <button className={styles.ghost} onClick={() => setConfirm(false)} disabled={finishing}>
              Not yet
            </button>
            <button className="cta" onClick={finish} disabled={finishing} data-busy={finishing}>
              {finishing ? 'Finishing…' : 'Yes, finish it'}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.err}>{error}</p>}
    </div>
  )
}

function PastTripCard({ trip }) {
  const c = copy(trip.vertical)
  const collected = (trip.price || 0) * (trip.seatsTaken || 0)
  return (
    <div className={`${styles.card} ${styles.done}`} data-vertical={trip.vertical}>
      <div className={styles.cardTop}>
        <CoverImage photo={trip.photo} title={trip.title} className={styles.thumb} />
        <div className={styles.cardBody}>
          <div className={styles.finishedTag}>FINISHED</div>
          <h3>{trip.title}</h3>
          <p className={styles.meta}>
            {trip.dates} · {trip.city}
          </p>
          <div className={styles.statRow}>
            <span>
              <b className="mono">{trip.seatsTaken}</b> {c.seats} filled
            </span>
            <span>
              <b className="mono">{rupees(collected)}</b> earned
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
