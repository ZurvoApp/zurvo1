import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/* Server-rendered on Vercel (no more static export): trips are created by
   organisers at any time, and a static build can't have a page for a trip that
   didn't exist when it ran. Pages now render on demand against Supabase.

   The dev server still gets its own output directory. `next dev` and `next build`
   both default to `.next`; building while dev is up would overwrite the chunks the
   running dev server holds ("Cannot find module './682.js'"). Splitting the dirs
   makes that impossible. The phase MUST come from Next's phase argument — Next
   re-loads this config inside forked build workers that carry no "build" in argv. */
export default function config(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER

  /** @type {import('next').NextConfig} */
  return {
    distDir: isDev ? '.next-dev' : '.next',
    // trailingSlash kept so existing /rides/, /trip/<id>/ links stay valid.
    trailingSlash: true,
    // The app uses plain <img> (Unsplash/DiceBear CDNs), not next/image.
    images: { unoptimized: true },
  }
}
