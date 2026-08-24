import { notFound } from 'next/navigation'
import { getTripById } from '@/lib/api'
import GroupChat from './GroupChat'

export const dynamic = 'force-dynamic'

export default async function GroupPage({ params }) {
  const trip = await getTripById(params.id)
  if (!trip) notFound()
  return <GroupChat trip={trip} />
}
