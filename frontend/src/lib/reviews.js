import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase'

const fromSnap = (d) => {
  const r = d.data()
  return { ...r, id: d.id, createdAt: r.createdAt?.toDate?.() ?? null, reply: r.reply && { ...r.reply, at: r.reply.at?.toDate?.() ?? null } }
}

function useReviewQuery(build, deps) {
  const [state, setState] = useState({ reviews: [], loading: true, error: null })
  useEffect(() => {
    const q = build()
    if (!q) return setState({ reviews: [], loading: false, error: null })
    return onSnapshot(q,
      (snap) => setState({ reviews: snap.docs.map(fromSnap), loading: false, error: null }),
      (error) => setState({ reviews: [], loading: false, error }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Published reviews for one room, newest first. */
export const useRoomReviews = (roomId, max = 50) =>
  useReviewQuery(() => roomId && query(collection(db, 'reviews'), where('roomId', '==', roomId), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(max)), [roomId, max])

/** Newest published reviews across the hotel (home page). */
export const useLatestReviews = (max = 12) =>
  useReviewQuery(() => query(collection(db, 'reviews'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(max)), [max])

/** Staff: every review, including hidden ones. */
export const useAllReviews = (max = 500) =>
  useReviewQuery(() => query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(max)), [max])

/** { avg, count, bars: [{ stars: 5, n, pct }, …] } from a list of reviews. */
export function summarize(reviews) {
  const count = reviews.length
  const sum = reviews.reduce((s, r) => s + r.rating, 0)
  const bars = [5, 4, 3, 2, 1].map((stars) => {
    const n = reviews.filter((r) => r.rating === stars).length
    return { stars, n, pct: count ? Math.round((n / count) * 100) : 0 }
  })
  return { avg: count ? Math.round((sum / count) * 10) / 10 : null, count, bars }
}

export const RATING_WORD = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** "May 2026" from "2026-05" */
export const stayMonth = (ym) => (ym ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
