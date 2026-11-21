import { useEffect } from 'react'

/*
 * Staff dashboard: sign out after `minutes` without any activity (front-desk computers are shared,
 * and the dashboard shows guests' details). Activity in any open dashboard tab counts: the last
 * activity time is shared through localStorage. If storage is blocked, each tab keeps its own timer.
 */
const KEY = 'mr-staff-last-activity'
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']

export function useIdleSignOut(minutes, onIdle) {
  useEffect(() => {
    const limit = minutes * 60_000
    let local = Date.now()
    let lastWrite = 0
    const read = () => {
      try { return Math.max(local, Number(localStorage.getItem(KEY)) || 0) } catch { return local }
    }
    const touch = () => {
      local = Date.now()
      if (local - lastWrite > 15_000) { // at most every 15 s
        lastWrite = local
        try { localStorage.setItem(KEY, String(local)) } catch { /* private mode: this tab only */ }
      }
    }
    touch()
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - read() > limit) {
        clearInterval(timer)
        onIdle()
      }
    }, 20_000)
    return () => {
      clearInterval(timer)
      EVENTS.forEach((e) => window.removeEventListener(e, touch))
    }
  }, [minutes, onIdle])
}
