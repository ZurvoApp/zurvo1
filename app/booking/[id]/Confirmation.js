'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Faces, Lock } from '@/components/Trust'
import { knownRiders, rupees } from '@/lib/data'
import { copy } from '@/lib/verticals'
import styles from './confirm.module.css'

/* The moment of maximum regret: "I just sent ₹4,800 to a stranger."
   He already knows he booked — he pressed the button. What he does not know is
   whether he has just been robbed. So escrow IS the screen. */
export default function Confirmation({ trip }) {
  const known = knownRiders(trip)
  const first = trip.organiser.name.split(' ')[0]
  const free = trip.price === 0
  const { noun } = copy(trip.vertical)

  useEffect(() => {
    document.documentElement.dataset.vertical = trip.vertical
  }, [trip.vertical])

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
        ) : (
          <>
            Your <em>{rupees(trip.price)}</em> is safe with Zurvo.
          </>
        )}
      </h1>
      <p className={styles.sub}>
        {free
          ? `${first} isn't charging for this ${noun}. Everyone splits fuel and food on the road.`
          : `${first} doesn't see a rupee of it until you've finished the ${noun}.`}
      </p>

      {/* Abstract "escrow protection" means nothing. His rupees, sitting in a
          middle step he can point at, means everything. */}
      {!free && (
        <>
          <ol className={styles.track}>
            <li className={styles.done}>
              <i />
              <div>
                <strong>You paid</strong>
                <span>Today, 9:42 PM · UPI</span>
              </div>
            </li>
            <li className={styles.now}>
              <i />
              <div>
                <strong>Zurvo is holding it</strong>
                <span>Until {trip.dates.split('–')[1] || trip.dates}, when you finish</span>
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

          {/* An exit he can see is what makes the entrance safe. */}
          <p className={styles.cancel}>
            Changed your mind? <b>Cancel free until {trip.cancelFreeUntil}</b> and the full {rupees(trip.price)} comes back to you.
          </p>
        </>
      )}

      <div className="rule" />

      {/* Money fear named first. Now he stops being a customer and becomes one of ten. */}
      <div className={`known-row ${styles.people}`} style={{ paddingTop: 16 }}>
        <Faces riders={trip.riders} max={5} />
        <p>
          <b style={{ color: 'var(--t-1)' }}>You&apos;re in.</b> {trip.riders.length} riders going
          {known.length > 0 && (
            <>
              {' '}— <br />
              {known.map((r) => r.name).join(' and ')} {known.length > 1 ? 'are two of them' : 'is one of them'}.
            </>
          )}
        </p>
      </div>

      {/* The single fact he will reopen this screen for at 5 AM on the 14th. */}
      <div className={styles.stub}>
        <div>
          <span>Meet</span>
          <b>{trip.meetOn}</b>
        </div>
        <div>
          <span>At</span>
          <b>{trip.meetAt}</b>
        </div>
      </div>

      <div className={styles.foot}>
        {/* Talking to the group is what turns a booking into a ride he won't cancel. */}
        <button className="cta">Say hi to the group</button>
        <Link className="link" href={`/trip/${trip.id}/`} style={{ display: 'block', textAlign: 'center' }}>
          View booking
        </Link>
      </div>
    </main>
  )
}
