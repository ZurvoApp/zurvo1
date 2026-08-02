// One-shot: wipe real (non-demo) rider accounts so testing starts clean.
// Deletes non-demo profiles (cascades their bookings/joins/tracks) AND their
// auth.users, so a fresh sign-up re-runs the profile trigger + onboarding.
// Demo seed rows (is_demo = true) are left untouched.
// Usage:  node reset-test-users.mjs --report   (show, delete nothing)
//         node reset-test-users.mjs --delete   (actually delete)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = 'c:/Users/MY PC/OneDrive/Desktop/zurvonew'
const env = Object.fromEntries(
  readFileSync(`${ROOT}/.env.local`, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const DELETE = process.argv.includes('--delete')

// 1) What's there now
const { data: profiles, error: pErr } = await db.from('profiles').select('id, user_id, name, is_demo')
if (pErr) throw pErr
const demo = profiles.filter((p) => p.is_demo)
const real = profiles.filter((p) => !p.is_demo)

const { data: userList, error: uErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (uErr) throw uErr
const authUsers = userList.users

console.log(`\nprofiles total: ${profiles.length}  (real: ${real.length}, demo/kept: ${demo.length})`)
console.log(`auth.users total: ${authUsers.length}`)
console.log(`\nReal profiles that will be removed:`)
real.forEach((p) => console.log(`  - ${p.name}  [profile ${p.id.slice(0, 8)}  user ${p.user_id ? p.user_id.slice(0, 8) : 'none'}]`))
if (demo.length) {
  console.log(`\nDemo profiles KEPT:`)
  demo.forEach((p) => console.log(`  - ${p.name}  [${p.id.slice(0, 8)}]`))
}

if (!DELETE) {
  console.log(`\n(report only — nothing deleted. re-run with --delete to apply)\n`)
  process.exit(0)
}

// 2) Delete real profile rows (cascades bookings / trip_riders / positions / tracks)
const realIds = real.map((p) => p.id)
if (realIds.length) {
  const { error } = await db.from('profiles').delete().in('id', realIds)
  if (error) throw error
  console.log(`\ndeleted ${realIds.length} profile rows (+ cascaded child rows)`)
}

// 3) Delete every auth user so returning logins don't land profile-less
let deletedUsers = 0
for (const u of authUsers) {
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) {
    console.log(`  ! failed to delete auth user ${u.id.slice(0, 8)}: ${error.message}`)
  } else {
    deletedUsers++
  }
}
console.log(`deleted ${deletedUsers}/${authUsers.length} auth users`)

// 4) Confirm final state
const { count } = await db.from('profiles').select('*', { count: 'exact', head: true })
const { data: after } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
console.log(`\nAFTER — profiles: ${count}   auth.users: ${after.users.length}\n`)
