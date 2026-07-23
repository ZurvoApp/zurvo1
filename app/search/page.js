'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import VerticalTabs from '@/components/VerticalTabs'
import Reveal from '@/components/Reveal'
import { TripRow } from '@/components/TripCard'
import { getTrips } from '@/lib/api'
import { copy } from '@/lib/verticals'
import styles from './search.module.css'

/* Discover tells him what to ride. This is where he goes when he has already
   decided he would rather look for himself.

   It searches the things a rider actually types — a place, a city, a difficulty —
   and nothing else. There is no relevance score and no fuzzy matching, because a
   catalogue this size does not have a ranking problem, and a wrong-but-confident
   result costs more trust than an empty one. */
const matches = (trip, q) =>
  [trip.title, trip.city, trip.difficulty, trip.dates, ...trip.route.map((r) => r.place)]
    .join(' ')
    .toLowerCase()
    .includes(q)

export default function Search() {
  const [vertical, setVertical] = useState('rides')
  const [q, setQ] = useState('')
  const [pool, setPool] = useState(null) // every trip in this vertical, all cities

  const c = copy(vertical)
  const query = q.trim().toLowerCase()

  // Refetch the pool per vertical; the query then filters it in-memory, so typing
  // never hits the network.
  useEffect(() => {
    let live = true
    setPool(null)
    getTrips({ vertical })
      .then((t) => live && setPool(t))
      .catch(() => live && setPool([]))
    return () => {
      live = false
    }
  }, [vertical])

  const loading = pool === null
  const results = useMemo(() => {
    const inVertical = pool ?? []
    return query ? inVertical.filter((t) => matches(t, query)) : inVertical
  }, [pool, query])

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Search" />

        <div className={styles.fieldWrap}>
          <label className={styles.field}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.8" stroke="currentColor" strokeWidth="1.9" />
              <path d="m15.6 15.6 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`A place, a city, a difficulty`}
              aria-label={`Search ${c.plural}`}
              enterKeyHint="search"
            />
            {q && (
              <button type="button" className={styles.clear} onClick={() => setQ('')} aria-label="Clear">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path
                    d="m4 4 7 7M11 4l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </label>
        </div>

        <VerticalTabs active={vertical} onChange={setVertical} />
      </header>

      <main className={styles.wrap} key={`${vertical}-${query}`}>
        {loading ? (
          <div className={styles.searchLoading} aria-busy="true">
            <span className={styles.spinner} />
          </div>
        ) : results.length === 0 ? (
          <div className={styles.empty}>
            <h2 className="ride-title">Nothing matches “{q.trim()}”.</h2>
            <p>
              We only list {c.plural} run by a verified organiser and paid through escrow. If it is not here, we
              could not stand behind it.
            </p>
            <button className="cta" onClick={() => setQ('')}>
              Show every {c.noun}
            </button>
          </div>
        ) : (
          <>
            <Reveal as="p" i={0} className="sec-label">
              {results.length} {results.length === 1 ? c.noun : c.plural}
              {query ? ' found' : ' open right now'}
            </Reveal>

            <div className={styles.list}>
              {results.map((t, i) => (
                <Reveal key={t.id} i={1 + i}>
                  <TripRow trip={t} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav current="search" />
    </>
  )
}
