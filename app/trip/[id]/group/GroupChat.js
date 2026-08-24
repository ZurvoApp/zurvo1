'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import RiderAvatar from '@/components/RiderAvatar'
import { getMyId, getTripMessages, sendTripMessage, subscribeToMessages } from '@/lib/api'
import { copy } from '@/lib/verticals'
import styles from './group.module.css'

/* The trip group. "Say hi to the group" has been on the confirmation screen since
   the beginning; this is the room it opens.

   Who can be in here is not decided by this file. The database answers it, with
   the same rule the live map uses — you belong to the trip, or you see nothing —
   so a link forwarded to an outsider opens an empty room rather than the ride's
   private conversation. A read that comes back empty for someone who isn't a
   participant is indistinguishable from a quiet group, which is exactly right:
   the door doesn't announce what's behind it.

   Messages arrive without a refresh. A group chat that needs pulling down to
   update isn't a group chat, it's an inbox. */

// Times only, and only when the gap is worth marking — a wall of timestamps on
// consecutive messages is noise, not information.
function stamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function sameMinute(a, b) {
  if (!a || !b) return false
  return Math.abs(new Date(a) - new Date(b)) < 60_000
}

export default function GroupChat({ trip }) {
  const router = useRouter()
  const [messages, setMessages] = useState(null) // null = still loading
  const [meId, setMeId] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)
  const { noun } = copy(trip.vertical)

  useEffect(() => {
    document.documentElement.dataset.vertical = trip.vertical
  }, [trip.vertical])

  const load = useCallback(() => {
    getTripMessages(trip.id)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [trip.id])

  useEffect(() => {
    getMyId().then(setMeId).catch(() => {})
    load()
  }, [load])

  // Every insert/delete on this trip's messages re-reads the thread. The thread
  // is small and capped, so a refetch is simpler — and more correct — than
  // splicing a realtime payload that arrives without its sender's profile.
  useEffect(() => {
    const unsub = subscribeToMessages(trip.id, load)
    return unsub
  }, [trip.id, load])

  // Land on the newest message, the way every messaging app does.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      await sendTripMessage(trip.id, body)
      setDraft('')
      load() // don't wait on the realtime round-trip to see your own words
    } catch (e) {
      setError(
        /row-level security|permission/i.test(e?.message || '')
          ? `Only riders on this ${noun} can post here. Book a seat and you're in.`
          : e?.message || 'That didn’t send. Try again.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.top}>
        <button className={styles.back} onClick={() => router.back()} aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M9.5 3 5 7.5 9.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className={styles.title}>
          <b>{trip.title}</b>
          <span>
            {trip.riders.length} {trip.riders.length === 1 ? 'rider' : 'riders'} · {trip.dates}
          </span>
        </div>
        <Link className={styles.tripLink} href={`/trip/${trip.id}/`}>
          Trip
        </Link>
      </header>

      <div className={styles.thread}>
        {messages === null ? (
          <div className="auth-loading" aria-busy="true">
            <span className="auth-spinner" />
          </div>
        ) : messages.length === 0 ? (
          /* An empty group is the normal state of a new trip, not a failure —
             so it reads as an invitation rather than an error. */
          <div className={styles.empty}>
            <p>No one has said anything yet.</p>
            <span>
              Say hi — riders who talk before the {noun} are the ones who actually turn up for it.
            </span>
          </div>
        ) : (
          <ul className={styles.list}>
            {messages.map((m, i) => {
              const mine = m.senderId === meId
              const prev = messages[i - 1]
              // Consecutive lines from one person read as one turn of speech, so
              // the name and face are drawn once at the top of the run.
              const runOn = prev && prev.senderId === m.senderId && sameMinute(prev.createdAt, m.createdAt)
              return (
                <li key={m.id} className={mine ? styles.mine : styles.theirs} data-runon={runOn || undefined}>
                  {!mine && !runOn && (
                    <span className={styles.face}>
                      <RiderAvatar gender={m.sender?.gender} />
                    </span>
                  )}
                  <div className={styles.bubbleWrap}>
                    {!mine && !runOn && <b className={styles.who}>{m.sender?.name ?? 'Rider'}</b>}
                    <p className={styles.bubble}>{m.body}</p>
                    <time className={styles.time}>{stamp(m.createdAt)}</time>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Say hi to the ${noun}…`}
          maxLength={2000}
          aria-label="Message the group"
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send">
          {sending ? (
            <span className="auth-spinner" style={{ width: 15, height: 15 }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12 20 4l-8 16-2.2-6.2L4 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </form>
    </main>
  )
}
