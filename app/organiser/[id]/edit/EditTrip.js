'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Reveal from '@/components/Reveal'
import { CoverImage } from '@/components/CoverImage'
import { getTripById, updateTrip, uploadTripPhoto } from '@/lib/api'
import { CITIES, rupees } from '@/lib/data'
import { copy } from '@/lib/verticals'
import createStyles from '@/app/create/create.module.css'
import styles from './edit.module.css'

/* Edit a trip you already run. It shows the fields an organiser is allowed to
   change after publishing — never the seats already sold or the trip's identity —
   and writes them back. Riders see the change on the trip page immediately, so a
   changed meet point or price is never something they hear about too late. */
export default function EditTrip({ id }) {
  const router = useRouter()
  const [trip, setTrip] = useState(undefined) // undefined = loading, null = not found
  const [f, setF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [photoError, setPhotoError] = useState(null)

  useEffect(() => {
    let live = true
    getTripById(id)
      .then((t) => {
        if (!live) return
        setTrip(t)
        if (t) {
          document.documentElement.dataset.vertical = t.vertical
          setF({
            photo: t.photo || '',
            title: t.title || '',
            dates: t.dates || '',
            days: String(t.days ?? ''),
            distanceKm: String(t.distanceKm ?? ''),
            difficulty: t.difficulty || copy(t.vertical).difficulty[0],
            price: String(t.price ?? ''),
            covers: t.covers || '',
            seatsTotal: String(t.seatsTotal ?? ''),
            meetOn: t.meetOn || '',
            meetAt: t.meetAt || '',
          })
        }
      })
      .catch(() => live && setTrip(null))
    return () => {
      live = false
    }
  }, [id])

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(null)
    setUploading(true)
    try {
      const url = await uploadTripPhoto(file)
      setF((prev) => ({ ...prev, photo: url }))
    } catch (err) {
      setPhotoError(err?.message || 'Could not upload that image.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      // Seats can't drop below what's already sold — that would oversell the ride.
      const seats = Math.max(Number(f.seatsTotal) || 0, trip.seatsTaken || 0)
      await updateTrip(id, { ...f, seatsTotal: seats })
      router.push('/organiser/')
    } catch (e) {
      setError(e?.message || 'Could not save your changes.')
      setSaving(false)
    }
  }

  if (trip === undefined)
    return (
      <div className="auth-loading" aria-busy="true">
        <span className="auth-spinner" />
      </div>
    )

  if (!trip || !f)
    return (
      <>
        <header className={createStyles.head}>
          <TopBar title="Edit trip" />
        </header>
        <main className={createStyles.wrap}>
          <p style={{ color: 'var(--t-2)', marginTop: 24 }}>That trip couldn’t be found.</p>
        </main>
        <BottomNav current="me" />
      </>
    )

  const c = copy(trip.vertical)
  const minSeats = trip.seatsTaken || 0

  return (
    <>
      <header className={createStyles.head}>
        <TopBar title={`Edit ${c.noun}`} />
      </header>

      <main className={createStyles.wrap}>
        <Reveal i={0}>
          <div className={createStyles.field}>
            <span className={createStyles.label}>Cover photo</span>
            <label className={createStyles.photoPicker} data-has={!!f.photo} aria-busy={uploading}>
              {f.photo ? (
                <>
                  <CoverImage photo={f.photo} title={f.title} className={createStyles.photoPreview} />
                  <span className={createStyles.photoOverlay}>{uploading ? 'Uploading…' : 'Change photo'}</span>
                </>
              ) : (
                <span className={createStyles.photoEmpty}>{uploading ? 'Uploading…' : 'Add a cover photo'}</span>
              )}
              <input type="file" accept="image/*" onChange={pickPhoto} disabled={uploading} hidden />
            </label>
            {photoError && <em className={styles.err}>{photoError}</em>}
          </div>
        </Reveal>

        <Reveal i={1}>
          <Field label="Title">
            <input value={f.title} onChange={set('title')} maxLength={54} />
          </Field>
        </Reveal>

        <Reveal i={2}>
          <div className={createStyles.pair}>
            <Field label="Dates">
              <input value={f.dates} onChange={set('dates')} placeholder="14–16 Aug" />
            </Field>
            <Field label="Difficulty">
              <select value={f.difficulty} onChange={set('difficulty')}>
                {c.difficulty.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
        </Reveal>

        <Reveal i={3}>
          <div className={createStyles.pair}>
            <Field label="Days">
              <input value={f.days} onChange={set('days')} inputMode="numeric" />
            </Field>
            <Field label="Distance (km)">
              <input value={f.distanceKm} onChange={set('distanceKm')} inputMode="numeric" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={4}>
          <div className={createStyles.pair}>
            <Field label={`${c.seats[0].toUpperCase() + c.seats.slice(1)} (min ${minSeats} sold)`}>
              <input value={f.seatsTotal} onChange={set('seatsTotal')} inputMode="numeric" />
            </Field>
            <Field label="Price per rider (₹)">
              <input value={f.price} onChange={set('price')} inputMode="numeric" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={5}>
          <Field label="What the price covers">
            <input value={f.covers} onChange={set('covers')} />
          </Field>
        </Reveal>

        <Reveal i={6}>
          <div className={createStyles.pair}>
            <Field label="Meet on">
              <input value={f.meetOn} onChange={set('meetOn')} placeholder="14 Aug, 5:30 AM" />
            </Field>
            <Field label="Meet at">
              <input value={f.meetAt} onChange={set('meetAt')} placeholder="Cubbon Park gate" />
            </Field>
          </div>
        </Reveal>

        <Reveal i={7} className={createStyles.foot}>
          <button className="cta" onClick={save} disabled={saving || uploading} data-busy={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="link" onClick={() => router.push('/organiser/')} style={{ display: 'block', margin: '0 auto' }}>
            Cancel
          </button>
          {error && <p className={styles.err}>{error}</p>}
          <p className={styles.note}>
            {rupees(Number(f.price) || 0)} per rider · changes show to riders on the {c.noun} page right away.
          </p>
        </Reveal>
      </main>

      <BottomNav current="me" />
    </>
  )
}

function Field({ label, children }) {
  return (
    <label className={createStyles.field}>
      <span className={createStyles.label}>{label}</span>
      {children}
    </label>
  )
}
