'use client'

import { useEffect, useRef, useState } from 'react'
import { getTripUpdates, postTripUpdate, subscribeToUpdates } from '@/lib/api'
import styles from './tripupdates.module.css'

/* The organiser's broadcast channel for one trip. Read-only for riders (they see
   it on their Live screen); with `canPost` it grows a composer for the organiser.
   Realtime, so a "leaving in 10" lands on every rider's phone without a refresh —
   this is the piece that closes the communication gap the app kept promising. */
function ago(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function TripUpdates({ tripId, canPost = false }) {
  const [updates, setUpdates] = useState(null) // null = loading
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const liveRef = useRef(true)

  useEffect(() => {
    liveRef.current = true
    const refresh = () =>
      getTripUpdates(tripId)
        .then((u) => liveRef.current && setUpdates(u))
        .catch(() => liveRef.current && setUpdates([]))
    refresh()
    const unsub = subscribeToUpdates(tripId, refresh)
    return () => {
      liveRef.current = false
      unsub()
    }
  }, [tripId])

  const post = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    setErr(null)
    try {
      await postTripUpdate(tripId, body)
      setText('')
    } catch (e) {
      setErr(e?.message || 'Could not post that update.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {canPost && (
        <div className={styles.composer}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell your riders something — “Leaving in 10”, “Fuel stop ahead”, “Rain, ride safe”…"
            maxLength={1000}
            rows={2}
          />
          <div className={styles.composerFoot}>
            <span className={styles.count}>{text.length}/1000</span>
            <button className="cta" onClick={post} disabled={busy || !text.trim()} data-busy={busy}>
              {busy ? 'Posting…' : 'Post update'}
            </button>
          </div>
          {err && <p className={styles.err}>{err}</p>}
        </div>
      )}

      {updates === null ? (
        <div className={styles.loading} aria-busy="true">
          <span className="auth-spinner" />
        </div>
      ) : updates.length === 0 ? (
        <p className={styles.empty}>
          {canPost
            ? 'No updates yet — anything you post here reaches every rider on this trip instantly.'
            : 'No updates from the organiser yet. They’ll show here the moment one is posted.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {updates.map((u) => (
            <li key={u.id} className={styles.item}>
              <span className={styles.dot} aria-hidden="true" />
              <div>
                <p>{u.body}</p>
                <time>{ago(u.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
