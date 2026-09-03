/* The states a rider can broadcast mid-ride, so the group never has to guess why
   someone stopped. One shared list — the picker, the map pin, the roster and the
   notifications all read from here, so a status can never mean one thing in the
   list and another on the map. `id` is what lands in the database. */
export const RIDE_STATUSES = [
  { id: 'riding', label: 'Riding', short: 'Riding', icon: '🏍️', tone: 'go', tag: null },
  { id: 'refuel', label: 'Refuelling', short: 'Refuel', icon: '⛽', tone: 'warn', tag: 'Refuel' },
  { id: 'break', label: 'Taking a break', short: 'Break', icon: '☕', tone: 'info', tag: 'Break' },
  { id: 'waiting', label: 'Waiting for the group', short: 'Waiting', icon: '⏳', tone: 'info', tag: 'Waiting' },
  { id: 'behind', label: 'Fell behind', short: 'Behind', icon: '🐢', tone: 'warn', tag: 'Behind' },
  { id: 'help', label: 'Need help', short: 'Help', icon: '🆘', tone: 'stop', tag: 'SOS' },
]

export const DEFAULT_STATUS = 'riding'

const BY_ID = Object.fromEntries(RIDE_STATUSES.map((s) => [s.id, s]))
export const rideStatus = (id) => BY_ID[id] || BY_ID[DEFAULT_STATUS]

// The colour a status paints with, resolved to the app's existing tokens.
export const statusColor = (id) => {
  const tone = rideStatus(id).tone
  return tone === 'stop' ? 'var(--stop)' : tone === 'warn' ? 'var(--warn)' : tone === 'info' ? '#5b8def' : 'var(--safe)'
}
