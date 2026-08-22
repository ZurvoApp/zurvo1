'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import { getLiveTrips, getTripPositions, sharePosition, stopSharing, subscribeToPositions, getMyId, appendTrackPoint } from '@/lib/api'
import { watchPosition, haversineKm } from '@/lib/geo'
import styles from './live.module.css'

// The map engine is browser-only and heavy — never render or import it on the server.
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false })

/* LIVE.
   The tab you open once you're on the road. It answers one question the other
   tabs can't: where is everyone RIGHT NOW. Nothing here is stored history — it's
   the live pins of the people on your ride, and it exists only while wheels are
   turning. Sharing is opt-in and per-person: you tap Go Live, you appear; you
   stop, you vanish. Zurvo never puts you on a map you didn't switch on. */
export default function Live() {
  const [trips, setTrips] = useState(null) // null = loading
  const [myId, setMyId] = useState(null)
  const [open, setOpen] = useState(null) // the trip whose map is open

  useEffect(() => {
    let live = true
    Promise.all([getLiveTrips(), getMyId()])
      .then(([t, id]) => {
        if (!live) return
        setTrips(t)
        setMyId(id)
      })
      .catch(() => live && setTrips([]))
    return () => {
      live = false
    }
  }, [])

  if (open) return <LiveRide trip={open} myId={myId} onBack={() => setOpen(null)} />

  const loading = trips === null
  const list = trips ?? []

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Live" />
      </header>

      <main className={styles.wrap}>
        {loading ? (
          <div className="auth-loading" style={{ minHeight: '50dvh' }}>
            <span className="auth-spinner" />
          </div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <Pulse />
            <h2>No ride to track yet</h2>
            <p>
              The live map turns on for a ride you’ve booked or you’re organising. Once you’re rolling, you’ll see every
              rider’s pin and speed here — and they’ll see yours, only while you choose to share.
            </p>
            <Link href="/" className="cta">
              Find a ride
            </Link>
          </div>
        ) : (
          <>
            <p className={styles.intro}>Open a ride to see who’s on the road — and share where you are.</p>
            <ul className={styles.trips}>
              {list.map((t) => (
                <li key={t.id}>
                  <button className={styles.trip} onClick={() => setOpen(t)} data-vertical={t.vertical}>
                    <img className={styles.thumb} src={t.photo} alt="" loading="lazy" decoding="async" />
                    <div className={styles.tripBody}>
                      <h2>{t.title}</h2>
                      <p className={styles.tripMeta}>
                        {t.city} · {t.riders.length} {t.riders.length === 1 ? 'rider' : 'riders'}
                      </p>
                      <span className={t.liveCount > 0 ? styles.liveNow : styles.dormant}>
                        {t.liveCount > 0 ? (
                          <>
                            <span className={styles.blip} />
                            {t.liveCount} live now
                          </>
                        ) : (
                          'Tap to go live'
                        )}
                      </span>
                    </div>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <BottomNav current="live" />
    </>
  )
}

/* One open ride: the map on top, a control sheet below. The sheet is where a
   rider does the two things this screen is for — turn their own sharing on, and
   read everyone else's speed. */
function LiveRide({ trip, myId, onBack }) {
  const [positions, setPositions] = useState([])
  const [myPos, setMyPos] = useState(null) // my own freshest fix, shown instantly
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const mapRef = useRef(null) // imperative handle into LiveMap (focusRider, fitAll)
  const stopWatch = useRef(null)
  const sharingRef = useRef(false)
  const lastSent = useRef(0)
  const lastTrack = useRef(null) // last breadcrumb saved to the recorded trail
  const wakeLock = useRef(null) // screen wake-lock sentinel, held while sharing

  const refresh = useCallback(() => {
    getTripPositions(trip.id)
      .then(setPositions)
      .catch(() => {})
  }, [trip.id])

  // First load + live subscription for everyone else's pins.
  useEffect(() => {
    refresh()
    const unsub = subscribeToPositions(trip.id, refresh)
    return () => unsub()
  }, [trip.id, refresh])

  // A gentle tick so "12s ago" stays honest without re-fetching.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 4000)
    return () => clearInterval(id)
  }, [])

  // Leaving the screen must always release the GPS and pull my pin.
  useEffect(() => {
    return () => {
      stopWatch.current?.()
      releaseWake()
      if (sharingRef.current) stopSharing(trip.id)
    }
  }, [trip.id])

  /* Keep the screen awake while sharing — a rider on the road shouldn't have to
     poke the phone to keep their pin alive. The lock drops when the tab is
     backgrounded, so re-acquire it whenever we come back to the foreground. */
  const requestWake = async () => {
    try {
      if ('wakeLock' in navigator) wakeLock.current = await navigator.wakeLock.request('screen')
    } catch {
      /* denied or unsupported — sharing still works, the screen just may sleep */
    }
  }
  const releaseWake = () => {
    wakeLock.current?.release?.().catch(() => {})
    wakeLock.current = null
  }
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sharingRef.current && !wakeLock.current) requestWake()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const goLive = () => {
    setError(null)
    sharingRef.current = true
    setSharing(true)
    requestWake()
    stopWatch.current = watchPosition(
      (p) => {
        setMyPos(p)
        const t = Date.now()
        // Throttle writes: GPS fires ~1/s, but co-riders don't need that firehose.
        if (sharingRef.current && t - lastSent.current > 2500) {
          lastSent.current = t
          sharePosition(trip.id, p).catch(() => {})
        }
        // Record the trail for the finished-ride share card. Drop a breadcrumb
        // only once the rider has actually moved ~25 m (or after a long pause),
        // so the saved route is a clean line, not a knot of standing-still jitter.
        const last = lastTrack.current
        const movedFar = !last || haversineKm(last, p) * 1000 > 25
        const longGap = !last || t - last.t > 8000
        if (sharingRef.current && (movedFar || longGap)) {
          lastTrack.current = { lat: p.lat, lng: p.lng, t }
          appendTrackPoint(trip.id, p).catch(() => {})
        }
      },
      (e) => {
        setError(e?.code === 1 ? 'Location permission denied. Allow it to share your position.' : 'Couldn’t get a GPS fix.')
        stopLive()
      },
    )
  }

  const stopLive = () => {
    sharingRef.current = false
    setSharing(false)
    setMyPos(null)
    lastTrack.current = null
    stopWatch.current?.()
    stopWatch.current = null
    releaseWake()
    stopSharing(trip.id).then(refresh)
  }

  // Merge: everyone from the DB, but overlay MY freshest local fix so my own pin
  // never lags behind my throttled writes. Tag who is me for styling.
  const merged = (() => {
    const others = positions.filter((p) => p.riderId !== myId).map((p) => ({ ...p, isMe: false }))
    if (sharing && myPos) {
      const meRow = positions.find((p) => p.riderId === myId)
      others.push({
        riderId: myId ?? 'me',
        ...myPos,
        name: 'You',
        initials: meRow?.initials ?? 'Y',
        tint: meRow?.tint ?? null,
        updatedAt: new Date().toISOString(),
        isMe: true,
      })
    } else {
      const meRow = positions.find((p) => p.riderId === myId)
      if (meRow) others.push({ ...meRow, name: 'You', isMe: true })
    }
    return others
  })()

  const roster = [...merged].sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : 0))

  return (
    <div className={styles.ride}>
      <div className={styles.mapWrap}>
        <LiveMap ref={mapRef} positions={merged} onError={(e) => setError(e.message)} />
        <button className={styles.back} onClick={onBack} aria-label="Back to rides">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4 6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={styles.mapTitle}>{trip.title}</div>
      </div>

      <div className={styles.sheet}>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.sheetHead}>
          <div>
            <p className="sec-label">On the road</p>
            <strong className={styles.count}>
              {merged.length === 0 ? 'No one live yet' : `${merged.length} ${merged.length === 1 ? 'rider' : 'riders'} live`}
            </strong>
          </div>
          <button className={sharing ? styles.stopBtn : styles.liveBtn} onClick={sharing ? stopLive : goLive}>
            {sharing ? (
              <>
                <span className={styles.stopDot} /> Stop sharing
              </>
            ) : (
              <>
                <span className={styles.goDot} /> Go live
              </>
            )}
          </button>
        </div>

        <ul className={styles.roster}>
          {roster.length === 0 ? (
            <li className={styles.rosterEmpty}>
              Be the first to go live — tap <b>Go live</b> and your ride-mates will see you move.
            </li>
          ) : (
            roster.map((p) => (
              <li key={p.riderId}>
                {/* Tapping a rider flies the map to their pin. */}
                <button
                  type="button"
                  className={styles.rider}
                  data-me={p.isMe}
                  onClick={() => mapRef.current?.focusRider(p.riderId)}
                  aria-label={`Center map on ${p.isMe ? 'you' : p.name}`}
                >
                  <span className={styles.avatar} style={{ background: p.isMe ? 'var(--accent)' : p.tint || '#5b8def' }}>
                    {p.initials}
                  </span>
                  <div className={styles.riderInfo}>
                    <b>{p.isMe ? 'You' : p.name}</b>
                    <span className={styles.riderSub}>{ago(p.updatedAt, now)}</span>
                  </div>
                  <span className={styles.speed}>
                    <b>{p.speedKmh}</b>
                    <em>km/h</em>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <p className={styles.privacy}>
          Only riders on this trip can see this map. You appear only while “Go live” is on.
        </p>
      </div>
    </div>
  )
}

function ago(iso, now) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'live now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return `${m}m ago`
}

function Chevron() {
  return (
    <svg className={styles.chev} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Pulse() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h4l2-5 3 10 2-5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
