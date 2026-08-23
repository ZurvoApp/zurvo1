import EditTrip from './EditTrip'

/* Rendered on demand — the trip id resolves against the database at request time,
   same as the public trip page. Organiser-only edits are enforced by RLS. */
export const dynamic = 'force-dynamic'

export default function EditTripPage({ params }) {
  return <EditTrip id={params.id} />
}
