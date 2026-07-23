'use client'

import styles from './template.module.css'

/* Next remounts this on every navigation, so it gives every route a consistent
   arrival: a short rise and fade. Pages should never hard-cut. */
export default function Template({ children }) {
  return <div className={styles.page}>{children}</div>
}
