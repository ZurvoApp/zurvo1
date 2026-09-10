'use client'

import { useEffect, useRef, useState } from 'react'
import { getRideTrack, getMe } from '@/lib/api'
import { trackStats } from '@/lib/geo'
import { renderTripStory, canvasToBlob } from '@/lib/story'
import styles from './sharetrip.module.css'

/* SHARE A FINISHED RIDE — Strava-style.
   Builds a story graphic: a white route line + white stat grid (km, time,
   speeds), the way Strava overlays a ride on a photo. Two ways to use it:
     • leave it as-is  -> a TRANSPARENT PNG the rider drops over their own
       photo/video in the Instagram Story editor;
     • add a photo here -> the same structure baked onto that image, one finished
       picture to post.
   The finished image goes to the OS share sheet (Instagram Stories on a phone),
   or downloads as a fallback. */
export default function ShareTrip({ trip, onClose }) {
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('building') // building | ready | error
  const [note, setNote] = useState('')
  const [hasBg, setHasBg] = useState(false)
  const canvasRef = useRef(null)
  const dataRef = useRef(null) // { track, stats, riderName } — fetched once
  const fileRef = useRef(null)

  // Render the card with an optional background (data URL). No bg = transparent.
  async function build(bg) {
    setStatus('building')
    const d = dataRef.current
    const canvas = await renderTripStory({
      trip,
      track: d.track,
      stats: d.stats,
      riderName: d.riderName,
      ridersCount: trip.riders?.length,
      startLabel: trip.route?.[0]?.place,
      endLabel: trip.route?.[trip.route.length - 1]?.place,
      bg: bg || null,
    })
    canvasRef.current = canvas
    setPreview(canvas.toDataURL('image/png'))
    setStatus('ready')
  }

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
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
        dataRef.current = { track, stats: trackStats(track), riderName }
        if (!live) return
        await build(null)
      } catch {
        if (live) setStatus('error')
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip])

  function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setHasBg(true)
      build(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function removeBg() {
    setHasBg(false)
    if (fileRef.current) fileRef.current.value = ''
    build(null)
  }

  async function share() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], `zurvo-${trip.id}.png`, { type: 'image/png' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: trip.title, text: `Just finished ${trip.title} with Zurvo 🏍️` })
      } catch {
        /* dismissed */
      }
    } else {
      download(blob)
      setNote(
        hasBg
          ? 'Saved — open Instagram, create a Story, and add it from your gallery.'
          : 'Saved a transparent overlay — in Instagram add your photo/video first, then add this on top.',
      )
    }
  }

  function download(blob) {
    const go = (bb) => {
      const url = URL.createObjectURL(bb)
      const a = document.createElement('a')
      a.href = url
      a.download = `zurvo-${trip.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
    if (blob) return go(blob)
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

        <div className={`${styles.stage} ${hasBg ? '' : styles.checker}`}>
          {status === 'building' && (
            <div className={styles.building}>
              <span className="auth-spinner" />
              <span>Drawing your route…</span>
            </div>
          )}
          {status === 'error' && <div className={styles.building}>Couldn’t build the image. Try again.</div>}
          {preview && <img className={styles.preview} src={preview} alt="Your ride, ready to share" />}
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
        <div className={styles.bgRow}>
          {hasBg ? (
            <button className={styles.chip} onClick={removeBg}>
              Remove photo · use transparent overlay
            </button>
          ) : (
            <button className={styles.chip} onClick={() => fileRef.current?.click()} disabled={status === 'building'}>
              <PhotoIcon /> Add your own background photo
            </button>
          )}
        </div>

        {note && <p className={styles.note}>{note}</p>}

        <div className={styles.actions}>
          <button className="cta" onClick={share} disabled={status !== 'ready'}>
            <InstaIcon /> Share
          </button>
          <button className={styles.ghost} onClick={() => download()} disabled={status !== 'ready'}>
            Save PNG
          </button>
        </div>
        <p className={styles.hint}>
          {hasBg
            ? '“Share” opens your phone’s share sheet — pick Instagram Stories.'
            : 'This is a transparent overlay. In Instagram, add your photo/video, then drop this on top — or add a photo here to bake it in.'}
        </p>
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

function PhotoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-3px' }}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="8" r="1.4" fill="currentColor" />
      <path d="M3 14l4-4 3 3 3-3 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
