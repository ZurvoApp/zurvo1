import { fill, knownRiders, rupees, seatsLeft, showScarcity } from '@/lib/data'
import { copy } from '@/lib/verticals'

const Lock = ({ size = 11 }) => (
  <svg width={size} height={size * 1.09} viewBox="0 0 11 12" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
    <rect x="1" y="5" width="9" height="6.4" rx="1.6" fill="var(--safe)" />
    <path d="M3 5V3.4a2.5 2.5 0 0 1 5 0V5" stroke="var(--safe)" strokeWidth="1.3" />
  </svg>
)

/* Faces. Riders you have ridden with wear the accent ring — that ring is the
   whole reason this component exists. */
export function Faces({ riders, max = 5 }) {
  const shown = riders.slice(0, max)
  const rest = riders.length - shown.length
  return (
    <div className="faces">
      {shown.map((r) => (
        <div key={r.id} className={'face' + (r.knownToMe ? ' known' : '')} style={{ background: r.tint }}>
          {r.name[0]}
        </div>
      ))}
      {rest > 0 && <div className="face more">+{rest}</div>}
    </div>
  )
}

/* "Who am I going with?" — answered before he asks it. The verb comes from the
   vertical: you have ridden with someone, or you have trekked with them. */
export function KnownRiders({ trip }) {
  const known = knownRiders(trip)
  const { verb } = copy(trip.vertical)
  return (
    <div className="known-row">
      <Faces riders={trip.riders} />
      {known.length > 0 ? (
        <p>
          <b>{known.map((r) => r.name).join(' and ')}</b> {known.length > 1 ? 'are' : 'is'} going.
          <br />
          You&apos;ve {verb} with {known.length > 1 ? 'both' : 'them'}.
        </p>
      ) : (
        <p>
          {trip.riders.length} riders going.
          <br />
          <span style={{ color: 'var(--t-2)' }}>None you&apos;ve {verb} with yet.</span>
        </p>
      )}
    </div>
  )
}

/* "Who is taking my money?" — organiser history is the trust unit, not the
   trip's star rating, because a new trip has no reviews and still has to sell. */
export function Organiser({ organiser, detailed = false }) {
  const o = organiser
  return (
    <div className="org">
      <div className="org-av">{o.initials}</div>
      <div style={{ minWidth: 0 }}>
        <div className="org-name">
          {o.name}
          {o.verified && (
            <span className="tick" title="ID verified">
              ✓
            </span>
          )}
        </div>
        <div className="org-sub">
          {detailed
            ? `ID verified · ${o.ridesHosted} rides · ★${o.rating} (${o.reviews}) · replies ${o.repliesIn}`
            : `${o.ridesHosted} rides hosted · ★ ${o.rating}`}
        </div>
      </div>
    </div>
  )
}

/* A price never appears naked. This component is why. */
export function PriceWithEscrow({ trip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0 5px' }}>
      <div className="price">
        {rupees(trip.price)}
        {trip.price > 0 && <small> /rider</small>}
      </div>
      {trip.price > 0 && (
        <div className="escrow-mini">
          <Lock />
          <span>
            Held by Zurvo until
            <br />
            you finish the {copy(trip.vertical).noun}
          </span>
        </div>
      )}
    </div>
  )
}

/* The last thing read before the button: my money is safe, and I can still walk away. */
export function EscrowBlock({ trip }) {
  const { noun } = copy(trip.vertical)
  if (trip.price === 0) {
    return (
      <div className="escrow-block">
        <Lock size={16} />
        <p>
          <b>This {noun} is free.</b> No money changes hands through Zurvo — everyone splits fuel and food on the road.
        </p>
      </div>
    )
  }
  return (
    <div className="escrow-block">
      <Lock size={16} />
      <p>
        <b>Zurvo holds your {rupees(trip.price)}.</b> {trip.organiser.name.split(' ')[0]} is paid 24 hours after you finish the {noun}.
        <em>Cancel free until {trip.cancelFreeUntil} — full refund, no questions.</em>
      </p>
    </div>
  )
}

/* Scarcity or silence. Renders nothing below the 60% floor — that is what stops
   it from becoming the boy who cried wolf.
   The bar fills rather than appears: watching it run up to 75% is what makes
   "3 seats left" land as a fact instead of a sticker. */
export function Seats({ trip, live = true }) {
  if (!showScarcity(trip)) return null
  return (
    <div className="seats">
      <div className="seats-top">
        <span>
          {seatsLeft(trip)} of {trip.seatsTotal} {copy(trip.vertical).seats} left
        </span>
        <span>closes {trip.closesOn}</span>
      </div>
      <div className="bar">
        {/* scaleX, not width: a width transition re-runs layout every frame;
            a transform runs on the compositor and costs the main thread nothing */}
        <i style={{ transform: `scaleX(${live ? fill(trip) : 0})` }} />
      </div>
    </div>
  )
}

export { Lock }
