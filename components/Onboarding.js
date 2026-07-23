'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CITIES } from '@/lib/data'
import { useAuth } from './AuthProvider'
import styles from './onboarding.module.css'

/* Runs once, right after a rider's first sign-in, before they see the app. It asks
   only for what a profile and a trip page actually show — a name, a home city, a
   bike — and writes them to the profile. Completing it (setting a city) is what
   flips the rider from "new" to "in". */
const STEPS = ['name', 'city', 'bike']

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  // Pre-fill only from a real provider name (Google). Test/email accounts have an
  // auto-generated name, so those start blank rather than showing junk.
  const [name, setName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
  const [city, setCity] = useState('')
  const [bike, setBike] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const finish = async () => {
    setSaving(true)
    setError(null)
    const initials = (name.trim()[0] || 'R').toUpperCase()
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() || 'Rider', initials, city, bike: bike.trim() || null })
      .eq('user_id', user.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    await refreshProfile() // profile now has a city → the gate lets the app through
  }

  const key = STEPS[step]
  const canAdvance = key === 'name' ? name.trim().length > 0 : key === 'city' ? !!city : true

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} className={styles.dot} data-on={i <= step} />
          ))}
        </div>
        {step > 0 && (
          <button className={styles.back} onClick={back} disabled={saving}>
            ← Back
          </button>
        )}
      </div>

      <div className={styles.body}>
        {key === 'name' && (
          <>
            <h1>Welcome to Zurvo.</h1>
            <p>What should other riders call you?</p>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              maxLength={40}
            />
          </>
        )}

        {key === 'city' && (
          <>
            <h1>Where do you ride from?</h1>
            <p>We’ll show you trips leaving your city first.</p>
            <div className={styles.cities}>
              {CITIES.map((c) => (
                <button
                  key={c}
                  className={styles.cityChip}
                  data-on={city === c}
                  onClick={() => setCity(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {key === 'bike' && (
          <>
            <h1>What do you ride?</h1>
            <p>Optional — it shows on your rider card. You can add it later.</p>
            <input
              className={styles.input}
              value={bike}
              onChange={(e) => setBike(e.target.value)}
              placeholder="e.g. Royal Enfield Himalayan"
              autoFocus
              maxLength={40}
            />
          </>
        )}
      </div>

      <div className={styles.foot}>
        {error && <p className={styles.error}>{error}</p>}
        {step < STEPS.length - 1 ? (
          <button className="cta" onClick={next} disabled={!canAdvance}>
            Continue
          </button>
        ) : (
          <button className="cta" onClick={finish} disabled={saving} data-busy={saving}>
            {saving ? 'Setting up…' : 'Start riding'}
          </button>
        )}
      </div>
    </div>
  )
}
