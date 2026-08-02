'use client'

import { useId } from 'react'

/* The rider's face on Zurvo is gear, not a cartoon head — a front-facing full-face
   helmet, the one thing every rider here has in common. It reads male or female at
   a glance (shell colour, visor tint, and hair peeking below the chin) without
   ever pretending to be a photo. `gender` comes straight off the profile row
   ('male' | 'female' | 'other'/null → neutral). */
const PALETTE = {
  male: {
    bg: ['#1b2740', '#0d1626'],
    shell: ['#4a5b78', '#25344c'],
    trim: '#9fb6de',
    glass: '#7fd3ff',
    hair: null,
  },
  female: {
    bg: ['#3a1830', '#1d0f1c'],
    shell: ['#e56d8b', '#a8386a'],
    trim: '#ffc9de',
    glass: '#ffd2ec',
    hair: '#2e1c12',
  },
  neutral: {
    bg: ['#232a36', '#141821'],
    shell: ['#6b7686', '#424b59'],
    trim: '#aeb8c6',
    glass: '#cfe0f0',
    hair: null,
  },
}

function normalize(gender) {
  if (gender === 'male' || gender === 'female') return gender
  return 'neutral'
}

export default function RiderAvatar({ gender, className, style }) {
  const g = normalize(gender)
  const c = PALETTE[g]
  const uid = useId().replace(/[:]/g, '')
  const bgId = `zbg-${uid}`
  const shellId = `zsh-${uid}`
  const glassId = `zgl-${uid}`

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      role="img"
      aria-label={`${g === 'neutral' ? '' : g + ' '}rider`}
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="34%" r="75%">
          <stop offset="0%" stopColor={c.bg[0]} />
          <stop offset="100%" stopColor={c.bg[1]} />
        </radialGradient>
        <linearGradient id={shellId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.shell[0]} />
          <stop offset="100%" stopColor={c.shell[1]} />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0e1622" />
          <stop offset="100%" stopColor="#060a12" />
        </linearGradient>
      </defs>

      {/* tinted disc behind everything, matching the round avatar frame */}
      <circle cx="50" cy="50" r="50" fill={`url(#${bgId})`} />

      {/* hair drawn first so it peeks out below/around the helmet */}
      {c.hair && (
        <g fill={c.hair}>
          <path d="M22 66C12 74 11 90 19 96L29 82C25 76 24 70 22 66Z" />
          <path d="M78 66C88 74 89 90 81 96L71 82C75 76 76 70 78 66Z" />
        </g>
      )}

      {/* helmet shell */}
      <path
        d="M50 12C68 12 84 24 87 43C88 51 87 59 83 66C82 75 78 83 68 88C62 91 56 92 50 92C44 92 38 91 32 88C22 83 18 75 17 66C13 59 12 51 13 43C16 24 32 12 50 12Z"
        fill={`url(#${shellId})`}
      />
      {/* top highlight — the sheen that makes it read as a glossy shell */}
      <path
        d="M34 22C40 17 46 15 52 15C61 15 70 18 76 25C68 21 60 20 52 20C46 20 40 20 34 22Z"
        fill={c.trim}
        opacity="0.55"
      />

      {/* visor / eye-port */}
      <rect x="24" y="35" width="52" height="21" rx="10.5" fill={`url(#${glassId})`} />
      <rect x="24" y="35" width="52" height="21" rx="10.5" fill="none" stroke={c.trim} strokeWidth="1.6" opacity="0.7" />
      {/* two reflection sweeps across the glass, in the gender tint */}
      <path d="M34 53L44 38H50L40 53Z" fill={c.glass} opacity="0.42" />
      <path d="M52 53L58 44H62L56 53Z" fill={c.glass} opacity="0.24" />

      {/* chin-bar vent */}
      <rect x="39" y="69" width="22" height="7" rx="3.5" fill="#0d141f" opacity="0.85" />
      <rect x="39" y="69" width="22" height="7" rx="3.5" fill="none" stroke={c.trim} strokeWidth="1.1" opacity="0.4" />
    </svg>
  )
}
