'use client'

import { useEffect, useRef, useState } from 'react'
import { getRideTrack, getMe } from '@/lib/api'
import { trackStats } from '@/lib/geo'
import { renderTripStory, canvasToBlob } from '@/lib/story'
import styles from './sharetrip.module.css'

/* SHARE A FINISHED RIDE.
   A sheet that turns one completed trip into an Instagram-story image: the route
   the rider rode, drawn Strava-style, with their real distance/time/speed. It
   builds the picture on a canvas (lib/story), shows a preview, then hands the PNG
   to the OS share sheet — on a phone that sheet includes "Instagram Stories".
   Where files can't be shared (most desktops), it falls back to a download. */
export default function ShareTrip({ trip, onClose }) {
  const [preview, setPreview] = useState(null) // dataURL for the on-screen preview
  const [status, setStatus] = useState('building') // building | ready | error
  const [note, setNote] = useState('')
  const canvasRef = useRef(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        // The recorded trail is the ideal source; if there's none (or Supabase
        // isn't wired), the card falls back to a generated route from the trip.
        let track = []
        let riderName = 'A Zurvo rider'
        try {
          track = await getRideTrack(trip.id)
        } catch {
          track = []
        }
        try {
          const me = await getMe()
          if (me?.name) riderName = me.name
        } catch {
          /* keep the default */
        }
        const stats = trackStats(track)
        const canvas = await renderTripStory({ trip, track, stats, riderName })
        if (!live) return
        canvasRef.current = canvas
        setPreview(canvas.toDataURL('image/png'))
        setStatus('ready')
      } catch (e) {
        if (live) setStatus('error')
      }
    })()
    return () => {
      live = false
    }
  }, [trip])

  async function share() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], `zurvo-${trip.id}.png`, { type: 'image/png' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: trip.title,
          text: `Just finished ${trip.title} with Zurvo 🏍️`,
        })
      } catch {
        /* user dismissed the sheet — nothing to do */
      }
    } else {
      download(blob)
      setNote('Saved the image — open Instagram, create a Story, and add it from your gallery.')
    }
  }

  function download(blob) {
    const b = blob || null
    const go = (bb) => {
      const url = URL.createObjectURL(bb)
      const a = document.createElement('a')
      a.href = url
      a.download = `zurvo-${trip.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
    if (b) return go(b)
    if (canvasRef.current) canvasToBlob(canvasRef.current).then(go)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Share your ride">
      <div className={styles.sheet} data-vertical={trip.vertical}>
        <div className={styles.grip} />
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <p className="sec-label">Share your ride</p>
        <h2 className={styles.title}>{trip.title}</h2>

        <div className={styles.stage}>
          {status === 'building' && (
            <div className={styles.building}>
              <span className="auth-spinner" />
              <span>Drawing your route…</span>
            </div>
          )}
          {status === 'error' && <div className={styles.building}>Couldn’t build the image. Try again.</div>}
          {preview && <img className={styles.preview} src={preview} alt="Your ride, ready to share" />}
        </div>

        {note && <p className={styles.note}>{note}</p>}

        <div className={styles.actions}>
          <button className="cta" onClick={share} disabled={status !== 'ready'}>
            <InstaIcon /> Share to Instagram
          </button>
          <button className={styles.ghost} onClick={() => download()} disabled={status !== 'ready'}>
            Save image
          </button>
        </div>
        <p className={styles.hint}>“Share” opens your phone’s share sheet — pick Instagram Stories.</p>
      </div>
    </div>
  )
}

function InstaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginRight: 8, verticalAlign: '-3px' }}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  )
}
