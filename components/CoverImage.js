import { forwardRef } from 'react'

/* A trip's cover image. When the trip has a photo it's a plain <img>, so every
   existing `.photo img` / `.heroPhoto img` style (object-fit, sizing, the parallax
   ref) applies untouched. When it doesn't — an organiser trip with no photo yet —
   it falls back to a self-contained SVG data-URI: a soft gradient with the trip's
   initial, so it reads as intentional rather than as a broken image. Because the
   fallback is still an <img>, nothing downstream has to special-case it. */
const fallbackSrc = (title) => {
  const ch = (String(title).trim()[0] || 'Z').toUpperCase()
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='300'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='#1D1D28'/><stop offset='1' stop-color='#131319'/>` +
    `</linearGradient></defs>` +
    `<rect width='480' height='300' fill='url(#g)'/>` +
    `<text x='50%' y='50%' dy='.35em' text-anchor='middle' ` +
    `font-family='Segoe UI, Arial, sans-serif' font-size='120' font-weight='800' ` +
    `fill='#34343f'>${ch}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export const CoverImage = forwardRef(function CoverImage({ photo, title = '', ...rest }, ref) {
  return <img ref={ref} src={photo || fallbackSrc(title)} alt="" {...rest} />
})
