import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project, RunningTimer, TimeEntry } from '../../../shared/types'

/** Lista projekata; ekran Projekti je menja, pa ima i reload. */
export function useProjects(): { projects: Project[]; reloadProjects: () => void } {
  const [projects, setProjects] = useState<Project[]>([])
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    window.api.listProjects().then(setProjects)
  }, [nonce])

  const reloadProjects = useCallback(() => setNonce((n) => n + 1), [])
  return { projects, reloadProjects }
}

/** Podesavanja iz baze; upis ide odmah, lokalno stanje se menja unapred. */
export function useSettings(): {
  settings: Record<string, string>
  setSetting: (key: string, value: string) => void
} {
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  const setSetting = useCallback((key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    window.api.setSetting(key, value)
  }, [])

  return { settings, setSetting }
}

export interface WeekData {
  entries: TimeEntry[]
  running: RunningTimer | null
  /** Minuti tekuce nedelje, bez timera koji trenutno radi. */
  currentWeekMinutes: number
  /** Ponovo cita sve iz baze. Zvati posle svake izmene. */
  reload: () => void
  loading: boolean
  /** Lokalna izmena bez cekanja na bazu, da UI ne kasni za kucanjem. */
  patchLocal: (id: string, patch: Partial<TimeEntry>) => void
  setRunningLocal: (patch: Partial<RunningTimer>) => void
}

/**
 * Cita unose prikazane nedelje [from, to) i stanje timera.
 * Sidebar uvek racuna tekucu nedelju, pa ona ide posebnim upitom.
 */
export function useWeek(from: string, to: string, currentFrom: string, currentTo: string): WeekData {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [running, setRunning] = useState<RunningTimer | null>(null)
  const [currentWeekMinutes, setCurrentWeekMinutes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    Promise.all([
      window.api.listEntries(from, to),
      window.api.getRunning(),
      window.api.minutesIn(currentFrom, currentTo)
    ]).then(([e, r, m]) => {
      if (!live.current) return
      setEntries(e)
      setRunning(r)
      setCurrentWeekMinutes(m)
      setLoading(false)
    })
    return () => {
      live.current = false
    }
  }, [from, to, currentFrom, currentTo, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const patchLocal = useCallback((id: string, patch: Partial<TimeEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const setRunningLocal = useCallback((patch: Partial<RunningTimer>) => {
    setRunning((prev) => (prev === null ? prev : { ...prev, ...patch }))
  }, [])

  return { entries, running, currentWeekMinutes, reload, loading, patchLocal, setRunningLocal }
}

/** Tik svake sekunde, aktivan samo kad timer radi. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const iv = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(iv)
  }, [active])

  return now
}

/** Odlaze upis u bazu dok korisnik kuca; poslednja vrednost po kljucu pobedjuje. */
export function useDebouncedWrite(delay = 350): (key: string, write: () => void) => void {
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) window.clearTimeout(t)
      map.clear()
    }
  }, [])

  return useCallback(
    (key: string, write: () => void) => {
      const existing = timers.current.get(key)
      if (existing !== undefined) window.clearTimeout(existing)
      timers.current.set(
        key,
        window.setTimeout(() => {
          timers.current.delete(key)
          write()
        }, delay)
      )
    },
    [delay]
  )
}
