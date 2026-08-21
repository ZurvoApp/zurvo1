'use client'

import Link from 'next/link'
import { fill, knownRiders, rupees, seatsLeft, showScarcity } from '@/lib/data'
import { copy } from '@/lib/verticals'
import { Faces, Lock } from './Trust'
import { CoverImage } from './CoverImage'
import styles from './tripcard.module.css'

/* The card everywhere except the hero.
   It carries the SAME three facts and the SAME one trust line as the hero — a
   smaller card is allowed to say less, never something different. */
export function TripCard({ trip, wide = false }) {
  const known = knownRiders(trip)
  const { seats } = copy(trip.vertical)

  return (
    <Link
      href={`/trip/${trip.id}/`}
      className={`${styles.card} ${wide ? styles.wide : ''}`}
      data-vertical={trip.vertical}
    >
      <div className={styles.photo}>
        <CoverImage photo={trip.photo} title={trip.title} loading="lazy" decoding="async" />
        <div className={styles.scrim} />

        {/* only ever one flag, and only when it is true */}
        {known.length > 0 ? (
          <span className={styles.flag}>
            <Faces riders={known} max={2} />
            {known.length} you know
          </span>
        ) : showScarcity(trip) ? (
          <span className={`${styles.flag} ${styles.hot}`}>
            {seatsLeft(trip)} {seats} left
          </span>
        ) : null}
      </div>

      <div className={styles.body}>
        <h3>{trip.title}</h3>
        <p className={styles.facts}>
          {trip.days}
          {trip.days === 1 ? 'd' : 'd'} · {trip.distanceKm} km · {trip.difficulty}
        </p>
        <div className={styles.foot}>
          <b>{rupees(trip.price)}</b>
          {trip.price > 0 && (
            <span className={styles.held}>
              <Lock size={9} /> held
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/* The row card: used where the list is long and the photo is not the argument. */
export function TripRow({ trip }) {
  const known = knownRiders(trip)
  return (
    <Link href={`/trip/${trip.id}/`} className={styles.row} data-vertical={trip.vertical}>
      <CoverImage photo={trip.photo} title={trip.title} loading="lazy" decoding="async" />
      <div>
        <h3>{trip.title}</h3>
        <p className={styles.facts}>
          {trip.dates} · {trip.distanceKm} km · {trip.difficulty}
        </p>
        <div className={styles.rowFoot}>
          <b>{rupees(trip.price)}</b>
          {known.length > 0 && <span className={styles.knows}>{known[0].name} is going</span>}
          {known.length === 0 && showScarcity(trip) && (
            <span className={styles.bar}>
              <i style={{ width: `${Math.round(fill(trip) * 100)}%` }} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
