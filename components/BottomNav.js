import Link from 'next/link'

/* Five tabs. Discover to be told what to ride, Search to go looking yourself,
   Live for who is on the road with you right now, My Rides for the ones he paid
   for, Me for who he is becoming.

   Live sits in the middle on purpose: it is the tab of the ride in progress, the
   thing under your thumb while wheels are turning. Creating a ride is still NOT a
   nav tab — it is a mode of Discover, reached by the Rider/Organiser switch. A
   nav slot is for a place you return to; organising is a hat you put on.

   The tab you are on is stated twice — filled icon AND white ink — because on a
   dark nav a colour shift alone is the first thing lost to a bright street. */
const TABS = [
  { id: 'discover', href: '/', label: 'Discover', Icon: Compass },
  { id: 'search', href: '/search/', label: 'Search', Icon: Glass },
  { id: 'live', href: '/live/', label: 'Live', Icon: Pin },
  { id: 'rides', href: '/rides/', label: 'My Rides', Icon: Calendar },
  { id: 'me', href: '/me/', label: 'Me', Icon: Person },
]

export default function BottomNav({ current }) {
  return (
    <nav className="nav">
      {TABS.map(({ id, href, label, Icon }) => {
        const on = current === id
        return (
          <Link key={id} href={href} aria-current={on ? 'page' : undefined}>
            <Icon on={on} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/* Each icon is an outline at rest and the same silhouette solid when you are
   standing in it. The geometry never changes between the two, so the icon cannot
   appear to shift when the tab becomes active. */
const SVG = (props) => (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props} />
)

function Compass({ on }) {
  return (
    <SVG>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.7}
        fill={on ? 'currentColor' : 'none'}
      />
      {/* the needle knocks out of the filled disc, so it survives either state */}
      <path
        d="M15.6 8.4 10.2 10.2 8.4 15.6l5.4-1.8 1.8-5.4Z"
        fill={on ? 'var(--bg-0)' : 'currentColor'}
      />
    </SVG>
  )
}

function Glass({ on }) {
  return (
    <SVG>
      <circle cx="10.5" cy="10.5" r="6.8" stroke="currentColor" strokeWidth={on ? 2.5 : 1.7} />
      <path
        d="m15.6 15.6 5 5"
        stroke="currentColor"
        strokeWidth={on ? 2.5 : 1.7}
        strokeLinecap="round"
      />
    </SVG>
  )
}

function Pin({ on }) {
  // A location pin whose inner dot knocks out of the filled state, so the shape
  // is the same silhouette at rest and active — it never appears to shift.
  return on ? (
    <SVG>
      <path
        d="M12 2.6c-3.9 0-7 3-7 6.8 0 4.9 5.6 10.7 6.4 11.5.3.3.9.3 1.2 0C13.4 20.1 19 14.3 19 9.4c0-3.8-3.1-6.8-7-6.8Z"
        fill="currentColor"
      />
      <circle cx="12" cy="9.3" r="2.5" fill="var(--bg-0)" />
    </SVG>
  ) : (
    <SVG>
      <path
        d="M12 2.6c-3.9 0-7 3-7 6.8 0 4.9 5.6 10.7 6.4 11.5.3.3.9.3 1.2 0C13.4 20.1 19 14.3 19 9.4c0-3.8-3.1-6.8-7-6.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="9.3" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </SVG>
  )
}

function Calendar({ on }) {
  return on ? (
    <SVG>
      <path
        d="M7 2.4h1.8v1.8h6.4V2.4H17v1.8h1.4A2.6 2.6 0 0 1 21 6.8V19a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 19V6.8a2.6 2.6 0 0 1 2.6-2.6H7V2.4Z"
        fill="currentColor"
      />
      <path d="M3 9h18" stroke="var(--bg-0)" strokeWidth="1.6" />
    </SVG>
  ) : (
    <SVG>
      <rect x="3" y="4.2" width="18" height="17.4" rx="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 9h18M7.9 2.4v3.4M16.1 2.4v3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </SVG>
  )
}

function Person({ on }) {
  return on ? (
    <SVG>
      <circle cx="12" cy="7.6" r="3.9" fill="currentColor" />
      <path d="M3.9 20.6a8.1 8.1 0 0 1 16.2 0 1 1 0 0 1-1 1H4.9a1 1 0 0 1-1-1Z" fill="currentColor" />
    </SVG>
  ) : (
    <SVG>
      <circle cx="12" cy="7.6" r="3.9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20.9a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </SVG>
  )
}
