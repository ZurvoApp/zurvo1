'use client'

import { useEffect, useState } from 'react'
import styles from './launch.module.css'

/* Decided once per page load, at module scope.
   It cannot live inside the effect: React Strict Mode runs effects twice in dev,
   so an effect that writes this flag and then reads it back would always see
   "already launched" on its second pass and dismiss its own splash. */
let seenBeforeThisLoad = null
function claimLaunch() {
  if (seenBeforeThisLoad === null) {
    seenBeforeThisLoad = sessionStorage.getItem('zurvo:launched') === '1'
    sessionStorage.setItem('zurvo:launched', '1')
  }
  return seenBeforeThisLoad
}

const HOLD = 700 // how long the mark owns the screen — long enough to land, short enough to never be waited on
const FADE = 460 // must match the transition in launch.module.css

/* The mark lands, holds for a beat, and the app rises through it.
   The dissolve is driven from state, not from a CSS animation-delay: an
   animation's clock starts whenever the stylesheet happens to apply, which races
   hydration and produces a splash that is already half gone when you first see
   it. A state-driven transition starts when we say it starts. */
export default function Launch() {
  const [skip, setSkip] = useState(false)
  const [out, setOut] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (claimLaunch()) {
      setSkip(true) // seen this session — a splash you meet twice is an obstacle
      return
    }
    const a = setTimeout(() => setOut(true), HOLD)
    const b = setTimeout(() => setDone(true), HOLD + FADE)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  if (skip || done) return null

  return (
    <div className={`${styles.veil} ${out ? styles.out : ''}`} aria-hidden="true">
      <div className={styles.mark}>
        <img src="/icon.png" alt="" width={84} height={84} />
      </div>
      <p className={styles.line}>Ride with people. Not with strangers.</p>
    </div>
  )
}
