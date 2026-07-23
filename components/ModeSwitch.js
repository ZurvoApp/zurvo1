import Link from 'next/link'

/* Two ways to be in Zurvo: a rider looking for a trip, or an organiser running
   one. It is a MODE, not a destination — the same marketplace seen from the two
   sides of the transaction — so it lives above the verticals, not in the nav.

   Picking Organiser routes to /create/, where the verticals disappear (you are no
   longer choosing a world to browse, you are building one trip in one of them). */
export default function ModeSwitch({ active }) {
  return (
    <div className="mode" role="tablist" aria-label="Rider or organiser">
      <Link href="/" role="tab" aria-selected={active === 'rider'} className="mode-tab">
        Rider
      </Link>
      <Link href="/create/" role="tab" aria-selected={active === 'organiser'} className="mode-tab">
        Organiser
      </Link>
      {/* the lit pill slides between the two — the whole point of a segmented
          control over two separate pills is that the motion says "same control" */}
      <span className="mode-thumb" data-at={active} aria-hidden="true" />
    </div>
  )
}
