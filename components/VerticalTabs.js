'use client'

import { useEffect } from 'react'
import { VERTICAL_LIST } from '@/lib/verticals'

/* The only global control on Discover. Switching it repaints the entire UI via
   a single token (--accent) — the layout is forbidden from changing. */
export default function VerticalTabs({ active, onChange }) {
  useEffect(() => {
    document.documentElement.dataset.vertical = active
  }, [active])

  return (
    <div className="verts" role="tablist" aria-label="Adventure verticals">
      {VERTICAL_LIST.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={active === v.id}
          className="vert"
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
