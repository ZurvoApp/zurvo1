'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Faces, Lock } from '@/components/Trust'
import { getMyBooking } from '@/lib/api'
import { knownRiders, rupees } from '@/lib/data'
import { copy } from '@/lib/verticals'
import styles from './confirm.module.css'

/* The moment of maximum regret: "I just sent ₹4,800 to a stranger."
   He already knows he booked — he pressed the button. What he does not know is
   whether he has just been robbed. So escrow IS the screen.

   Everything here is read from HIS booking, never assumed from the URL. This page
   used to render for anyone who typed the address, congratulating them on a seat
   that didn't exist and quoting a payment time that was hard-coded — which is a
   strange thing for a screen whose entire job is being believed. */

// "Today, 9:42 PM" for a booking made today; a date once it isn't.
function when(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  if (sameDay) return `Today, ${time}`
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

export default function Confirmation({ trip }) {
  const [booking, setBooking] = useState(undefined) // undefined = still looking
  const known = knownRiders(trip)
  const first = trip.organiser.name.split(' ')[0]
  const free = trip.price === 0
  const { noun } = copy(trip.vertical)

  useEffect(() => {
    document.documentElement.dataset.vertical = trip.vertical
  }, [trip.vertical])

  useEffect(() => {
    let alive = true
    getMyBooking(trip.id)
      .then((b) => alive && setBooking(b))
      .catch(() => alive && setBooking(null))
    return () => {
      alive = false
    }
  }, [trip.id])

  if (booking === undefined)
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )

  /* No booking. Reached by typing the URL, or by opening an old link after
     cancelling. Say so plainly — the one thing this screen must never do is
     tell someone they have a seat they don't have. */
  if (!booking)
    return (
      <main className={styles.wrap}>
        <div className={styles.vault}>
          <Lock size={22} />
        </div>
        <h1 className={styles.headline}>You don&apos;t have a seat on this {noun} yet.</h1>
        <p className={styles.sub}>Nothing has been booked and nothing has been charged.</p>
        <div className={styles.foot}>
          <Link className="cta" href={`/trip/${trip.id}/`} style={{ display: 'block', textAlign: 'center' }}>
            Look at the {noun}
          </Link>
          <Link className="link" href="/rides/" style={{ display: 'block', textAlign: 'center' }}>
            My rides
          </Link>
        </div>
      </main>
    )

  const cancelled = booking.status === 'cancelled'
  const paidAt = when(booking.createdAt)
  // A seat is HELD the moment it's booked; it is PAID only once money moved.
  // Saying "you paid" before that is the one lie this screen can't afford.
  const hasPaid = booking.paid > 0

  if (cancelled)
    return (
      <main className={styles.wrap}>
        <div className={styles.vault}>
          <Lock size={22} />
        </div>
        <h1 className={styles.headline}>This booking was cancelled.</h1>
        <p className={styles.sub}>
          Your seat went back to the {noun}
          {!free && <> and nothing is being held.</>}
        </p>
        <div className={styles.foot}>
          <Link className="cta" href={`/trip/${trip.id}/`} style={{ display: 'block', textAlign: 'center' }}>
            Look at the {noun} again
          </Link>
        </div>
      </main>
    )

  return (
    <main className={styles.wrap}>
      <div className={styles.vault}>
        <Lock size={22} />
      </div>

      {/* The headline of the screen is the escrow promise, in his own money,
          in the largest type on the page. Not a green tick. */}
      <h1 className={styles.headline}>
        {free ? (
          <>
            You&apos;re in. <em>No money</em> changes hands.
          </>
        ) : hasPaid ? (
          <>
            Your <em>{rupees(trip.price)}</em> is safe with Zurvo.
          </>
        ) : (
          <>
            Your seat is held. <em>Nothing</em> has been charged.
          </>
        )}
      </h1>
      <p className={styles.sub}>
        {free
          ? `${first} isn't charging for this ${noun}. Everyone splits fuel and food on the road.`
          : hasPaid
            ? `${first} doesn't see a rupee of it until you've finished the ${noun}.`
            : `${rupees(trip.price)} is due before you ride, and ${first} doesn't see a rupee of it until the ${noun} is over.`}
      </p>

      {/* Abstract "escrow protection" means nothing. His rupees, sitting in a
          middle step he can point at, means everything. */}
      {!free && (
        <>
          <ol className={styles.track}>
            <li className={styles.done}>
              <i />
              <div>
                <strong>{hasPaid ? 'You paid' : 'Seat reserved'}</strong>
                <span>{paidAt ?? 'Just now'}</span>
              </div>
            </li>
            <li className={hasPaid ? styles.now : styles.pending}>
              <i />
              <div>
                <strong>Zurvo {hasPaid ? 'is holding it' : 'holds it'}</strong>
                <span>Until {trip.dates?.split('–')[1]?.trim() || trip.dates}, when you finish</span>
              </div>
            </li>
            <li className={styles.pending}>
              <i />
              <div>
                <strong>{first} gets paid</strong>
                <span>24 hours after the {noun} ends</span>
              </div>
            </li>
          </ol>

          {/* An exit he can see is what makes the entrance safe. Only shown when
              there is a real date to name — "cancel free until ___" reassures
              nobody and reads as a page that's broken. */}
          {trip.cancelFreeUntil && (
            <p className={styles.cancel}>
              Changed your mind? <b>Cancel free until {trip.cancelFreeUntil}</b> and the full {rupees(trip.price)}{' '}
              comes back to you.
            </p>
          )}
        </>
      )}

      <div className="rule" />

      {/* Money fear named first. Now he stops being a customer and becomes one of ten. */}
      <div className={`known-row ${styles.people}`} style={{ paddingTop: 16 }}>
        <Faces riders={trip.riders} max={5} />
        <p>
          <b style={{ color: 'var(--t-1)' }}>You&apos;re in.</b>{' '}
          {trip.riders.length === 1 ? 'You’re the first one going' : `${trip.riders.length} riders going`}
          {known.length > 0 && (
            <>
              {' '}— <br />
              {known.map((r) => r.name).join(' and ')} {known.length > 1 ? 'are two of them' : 'is one of them'}.
            </>
          )}
        </p>
      </div>

      {/* The single fact he will reopen this screen for at 5 AM on the 14th —
          but only once the organiser has actually named a place and a time.
          An empty "Meet / At" is worse than no panel: it looks like the plan
          exists and he simply can't see it. */}
      {(trip.meetOn || trip.meetAt) && (
        <div className={styles.stub}>
          {trip.meetOn && (
            <div>
              <span>Meet</span>
              <b>{trip.meetOn}</b>
            </div>
          )}
          {trip.meetAt && (
            <div>
              <span>At</span>
              <b>{trip.meetAt}</b>
            </div>
          )}
        </div>
      )}

      <div className={styles.foot}>
        {/* Talking to the group is what turns a booking into a ride he won't cancel. */}
        <Link className="cta" href={`/trip/${trip.id}/group/`} style={{ display: 'block', textAlign: 'center' }}>
          Say hi to the group
        </Link>
        <Link className="link" href="/rides/" style={{ display: 'block', textAlign: 'center' }}>
          View booking
        </Link>
      </div>
    </main>
  )
}
