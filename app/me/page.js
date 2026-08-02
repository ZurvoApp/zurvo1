'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import Reveal from '@/components/Reveal'
import Settings from '@/components/Settings'
import RiderAvatar from '@/components/RiderAvatar'
import { useAuth } from '@/components/AuthProvider'
import styles from './me.module.css'

/* ONE JOB: give him something he is proud to screenshot.
   A profile that only lists settings is an admin page. This is an identity card —
   the numbers he earned, ranked against his own city, with his face on it. */
export default function Me() {
  const { profile } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Gated by AuthGate, so a session exists; the profile row may lag a new sign-up
  // by a moment while the DB trigger runs.
  if (!profile) {
    return (
      <>
        <header className={styles.head}>
          <TopBar title="Me" />
        </header>
        <main className={styles.wrap}>
          <div className="auth-loading" style={{ minHeight: '50dvh' }}>
            <span className="auth-spinner" />
          </div>
        </main>
        <BottomNav current="me" />
      </>
    )
  }

  const name = profile.name || 'Rider'
  const km = profile.km ?? 0
  const rides = profile.rides ?? 0
  const states = profile.states ?? 0
  const trust = profile.trust_score ?? 0
  const hasRank = profile.city_rank && profile.city_riders
  const topPct = hasRank ? Math.max(1, Math.round((profile.city_rank / profile.city_riders) * 100)) : null
  const isNew = rides === 0

  return (
    <>
      <header className={styles.head}>
        <TopBar title="Me" />
      </header>

      <main className={styles.wrap}>
        {/* the card. everything above the fold is his, and nothing on it is an ad. */}
        <Reveal i={0} className={styles.card}>
          <div className={styles.glow} aria-hidden="true" />

          <div className={styles.identity}>
            <div className={styles.avatar}>
              <RiderAvatar gender={profile.gender} />
            </div>
            <div>
              <h1>
                {name}
                {profile.verified && (
                  <span className="tick" title="ID verified">
                    ✓
                  </span>
                )}
              </h1>
              <p className={styles.sub}>
                {[profile.bike, profile.city, profile.since && `riding since ${profile.since}`]
                  .filter(Boolean)
                  .join(' · ') || 'New to Zurvo'}
              </p>
            </div>
          </div>

          <div className={styles.stats}>
            <Stat value={km.toLocaleString('en-IN')} label="KM RIDDEN" />
            <Stat value={rides} label="RIDES" />
            <Stat value={states} label="STATES" />
          </div>

          {hasRank && (
            <div className={styles.rank}>
              <span className="mono">#{profile.city_rank}</span>
              <p>
                in {profile.city} — top {topPct}% of {profile.city_riders.toLocaleString('en-IN')} riders
              </p>
            </div>
          )}
        </Reveal>

        {/* trust is a number other people rely on, so it is stated plainly */}
        <Reveal i={1} className={styles.trust}>
          <div className={styles.trustTop}>
            <span>Trust score</span>
            <b className="mono">{trust}/100</b>
          </div>
          <div className={styles.trustBar}>
            <i style={{ width: `${trust}%` }} />
          </div>
          <p>
            {isNew
              ? 'Verify your ID and finish your first ride to build a score organisers trust.'
              : `${profile.verified ? 'ID verified, ' : ''}${rides} ${rides === 1 ? 'ride' : 'rides'} finished. Organisers see this before they approve you.`}
          </p>
        </Reveal>

        <Reveal as="p" i={2} className="sec-label" style={{ marginTop: 28 }}>
          Badges
        </Reveal>
        <Reveal i={3}>
          <div className={styles.badgesEmpty}>
            {isNew
              ? 'Your first badge is one ride away.'
              : 'Keep riding — badges land as you cross new milestones.'}
          </div>
        </Reveal>

        <Reveal i={4}>
          <button className="cta" style={{ marginTop: 26 }}>
            Share my rider card
          </button>
          <button
            className="link"
            onClick={() => setSettingsOpen(true)}
            style={{ display: 'block', textAlign: 'center', width: '100%' }}
          >
            Settings
          </button>
        </Reveal>
      </main>

      <BottomNav current="me" />

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function Stat({ value, label }) {
  return (
    <div className={styles.stat}>
      <b className="mono">{value}</b>
      <span>{label}</span>
    </div>
  )
}
