import { notFound } from 'next/navigation'
import { getTripById } from '@/lib/api'
import Confirmation from './Confirmation'

export const dynamic = 'force-dynamic'

export default async function BookingPage({ params }) {
  const trip = await getTripById(params.id)
  if (!trip) notFound()
  return <Confirmation trip={trip} />
}
