import { notFound } from 'next/navigation'
import { getTripById } from '@/lib/api'
import TripDetail from './TripDetail'

/* Rendered on demand: any trip id resolves against the database at request time,
   so a ride published a minute ago has a working page without a rebuild. */
export const dynamic = 'force-dynamic'

export default async function TripPage({ params }) {
  const trip = await getTripById(params.id)
  if (!trip) notFound()
  return <TripDetail trip={trip} />
}
