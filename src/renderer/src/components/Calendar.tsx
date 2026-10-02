import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project, TimeEntry } from '../../../shared/types'
import { DAY_LABELS, addDays, dayKey, fmtMinutes, minutesOfDay, pluralEntries } from '../lib/time'

const PX_PER_MIN = 0.9 // 54px po satu
const SNAP_MIN = 15
const MIN_DURATION = 15

interface Props {
  monday: Date
  entries: TimeEntry[]
  projects: Project[]
  dayStartHour: number
  dayEndHour: number
  onCreate: (start: Date, end: Date) => void
  onMove: (id: string, start: Date, end: Date) => void
  onSelect: (entry: TimeEntry) => void
}

type Gesture =
  | { kind: 'create'; day: number; anchorMin: number; fromMin: number; toMin: number }
  | { kind: 'move'; id: string; day: number; grabOffset: number; length: number; fromMin: number }
  | { kind: 'resize'; id: string; day: number; fromMin: number; toMin: number }

interface Placed {
  entry: TimeEntry
  from: number
  to: number
  /** Kolona unutar grupe preklopljenih unosa, i koliko ih grupa ima ukupno. */
  col: number
  cols: number
}

const snap = (min: number): number => Math.round(min / SNAP_MIN) * SNAP_MIN
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Minut u danu -> "HH:MM". */
function hhmmOf(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Deli preklopljene unose po sirini kolone. Unosi se slazu po pocetku, pa se
 * grupisu dok se lanac preklapanja ne prekine; unutar grupe svaki dobija prvu
 * kolonu koja se oslobodila.
 */
function layoutDay(items: { entry: TimeEntry; from: number; to: number }[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to)
  const out: Placed[] = []
  let group: Placed[] = []
  let groupEnd = -1

  const flush = (): void => {
    const cols = group.reduce((max, p) => Math.max(max, p.col + 1), 0)
    for (const p of group) out.push({ ...p, cols })
    group = []
    groupEnd = -1
  }

  for (const it of sorted) {
    if (group.length > 0 && it.from >= groupEnd) flush()
    // prva kolona ciji se poslednji unos zavrsio pre ovog
    const taken = new Set(group.filter((p) => p.to > it.from).map((p) => p.col))
    let col = 0
    while (taken.has(col)) col++
    group.push({ ...it, col, cols: 1 })
    groupEnd = Math.max(groupEnd, it.to)
  }
  if (group.length > 0) flush()

  return out
}

export default function Calendar({
  monday,
  entries,
  projects,
  dayStartHour,
  dayEndHour,
  onCreate,
  onMove,
  onSelect
}: Props): React.JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [nowMin, setNowMin] = useState(() => minutesOfDay(new Date()))

  const startMin = dayStartHour * 60
  const endMin = dayEndHour * 60
  const height = (endMin - startMin) * PX_PER_MIN
  const hours: number[] = []
  for (let h = dayStartHour; h <= dayEndHour; h++) hours.push(h)

  // Linija "sad" se pomera svakog minuta.
  useEffect(() => {
    const iv = window.setInterval(() => setNowMin(minutesOfDay(new Date())), 60_000)
    return () => window.clearInterval(iv)
  }, [])

  /** Y u pikselima -> minut u danu, uz snap i ogranicenje na vidljivi opseg. */
  function minuteAt(clientY: number): number {
    const box = gridRef.current?.getBoundingClientRect()
    if (box === undefined) return startMin
    return clamp(snap(startMin + (clientY - box.top) / PX_PER_MIN), startMin, endMin)
  }

  /** X u pikselima -> indeks dana 0..6. */
  function dayAt(clientX: number): number {
    const box = gridRef.current?.getBoundingClientRect()
    if (box === undefined) return 0
    return clamp(Math.floor((clientX - box.left) / (box.width / 7)), 0, 6)
  }

  function dateAt(dayIndex: number, min: number): Date {
    const d = addDays(monday, dayIndex)
    d.setHours(0, 0, 0, 0)
    d.setMinutes(min)
    return d
  }

  function commit(g: Gesture): void {
    if (g.kind === 'create') {
      if (g.toMin - g.fromMin < MIN_DURATION) return
      onCreate(dateAt(g.day, g.fromMin), dateAt(g.day, g.toMin))
      return
    }
    if (g.kind === 'move') {
      onMove(g.id, dateAt(g.day, g.fromMin), dateAt(g.day, g.fromMin + g.length))
      return
    }
    onMove(g.id, dateAt(g.day, g.fromMin), dateAt(g.day, g.toMin))
  }

  // Gest traje preko mnogo rendera; ref drzi sveze funkcije, pa se listeneri
  // kace jednom po gestu umesto na svaki pomeraj misa.
  const latest = useRef({ minuteAt, dayAt, commit, startMin, endMin })
  latest.current = { minuteAt, dayAt, commit, startMin, endMin }

  const dragging = gesture !== null

  useEffect(() => {
    if (!dragging) return

    function onMouseMove(ev: MouseEvent): void {
      const l = latest.current
      const min = l.minuteAt(ev.clientY)
      setGesture((g) => {
        if (g === null) return g
        if (g.kind === 'create') {
          return { ...g, fromMin: Math.min(g.anchorMin, min), toMin: Math.max(g.anchorMin, min) }
        }
        if (g.kind === 'move') {
          return {
            ...g,
            day: l.dayAt(ev.clientX),
            fromMin: clamp(min - g.grabOffset, l.startMin, l.endMin - g.length)
          }
        }
        return { ...g, toMin: Math.max(g.fromMin + MIN_DURATION, min) }
      })
    }

    function onMouseUp(): void {
      setGesture((g) => {
        if (g !== null) latest.current.commit(g)
        return null
      })
    }

    // Escape prekida gest bez upisa.
    function onKeyDown(ev: KeyboardEvent): void {
      if (ev.key === 'Escape') setGesture(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dragging])

  const todayKey = dayKey(new Date())

  const { columns, hiddenCount } = useMemo(() => {
    let hidden = 0
    const cols = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      const key = dayKey(date)
      const raw = entries
        .filter((e) => dayKey(e.start) === key)
        .map((e) => {
          const from = minutesOfDay(new Date(e.start))
          const dur = Math.max(MIN_DURATION, Math.round((+new Date(e.end) - +new Date(e.start)) / 60000))
          return { entry: e, from, to: from + dur }
        })
      // Unos koji je ceo van prikazanog opsega se ne crta — inace bi se zalepio
      // za ivicu i izgledao kao da je u drugo vreme.
      const visible = raw.filter((r) => r.to > startMin && r.from < endMin)
      hidden += raw.length - visible.length
      return { key, date, isToday: key === todayKey, items: layoutDay(visible) }
    })
    return { columns: cols, hiddenCount: hidden }
  }, [entries, monday, startMin, endMin, todayKey])

  const dragId = gesture !== null && gesture.kind !== 'create' ? gesture.id : null

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-gutter" />
        {columns.map((c, i) => (
          <div key={c.key} className={`cal-day-head${c.isToday ? ' is-today' : ''}`}>
            <span className="cal-dow">{DAY_LABELS[i]}</span>
            <span className="cal-date">{c.date.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="cal-body">
        <div className="cal-gutter">
          {hours.map((h) => (
            <div key={h} className="cal-hour-label" style={{ height: 60 * PX_PER_MIN }}>
              <span>{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        <div className="cal-grid" ref={gridRef} style={{ height }}>
          {hours.slice(0, -1).map((h, i) => (
            <div
              key={h}
              className="cal-hour-line"
              style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
            />
          ))}

          {columns.map((c, dayIndex) => (
            <div
              key={c.key}
              className={`cal-col${c.isToday ? ' is-today' : ''}`}
              style={{ left: `${(dayIndex * 100) / 7}%`, width: `${100 / 7}%` }}
              onMouseDown={(ev) => {
                if (ev.button !== 0 || ev.target !== ev.currentTarget) return
                const min = minuteAt(ev.clientY)
                setGesture({ kind: 'create', day: dayIndex, anchorMin: min, fromMin: min, toMin: min })
              }}
            >
              {c.isToday && nowMin >= startMin && nowMin <= endMin && (
                <div className="cal-now" style={{ top: (nowMin - startMin) * PX_PER_MIN }} />
              )}

              {c.items.map(({ entry, from, to, col, cols }) => {
                if (entry.id === dragId) return null
                const project = projects.find((p) => p.id === entry.projectId) ?? null
                const visFrom = clamp(from, startMin, endMin)
                const visTo = clamp(to, startMin, endMin)
                const top = (visFrom - startMin) * PX_PER_MIN
                const h = Math.max(16, (visTo - visFrom) * PX_PER_MIN)
                return (
                  <div
                    key={entry.id}
                    className={`cal-block${cols > 2 ? ' tight' : ''}`}
                    title={`${entry.desc || 'Bez opisa'}
${hhmmOf(from)} – ${hhmmOf(to)} · ${fmtMinutes(to - from)}`}
                    style={{
                      top,
                      height: h,
                      left: `calc(${(col * 100) / cols}% + 3px)`,
                      width: `calc(${100 / cols}% - 6px)`,
                      background: project ? `${project.color}1F` : '#EFEEEA',
                      borderLeftColor: project?.color ?? '#B9B8B2'
                    }}
                    onClick={() => onSelect(entry)}
                    onMouseDown={(ev) => {
                      if (ev.button !== 0) return
                      ev.stopPropagation()
                      setGesture({
                        kind: 'move',
                        id: entry.id,
                        day: dayIndex,
                        grabOffset: minuteAt(ev.clientY) - from,
                        length: to - from,
                        fromMin: from
                      })
                    }}
                  >
                    <div className="cal-block-title">{entry.desc || 'Bez opisa'}</div>
                    {cols <= 2 && (
                      <div className="cal-block-meta">
                        {hhmmOf(from)} – {hhmmOf(to)}
                      </div>
                    )}
                    {h >= 54 && cols === 1 && (
                      <div className="cal-block-dur">{fmtMinutes(to - from)}</div>
                    )}
                    <div
                      className="cal-block-handle"
                      onMouseDown={(ev) => {
                        if (ev.button !== 0) return
                        ev.stopPropagation()
                        setGesture({ kind: 'resize', id: entry.id, day: dayIndex, fromMin: from, toMin: to })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          ))}

          {gesture !== null && (
            <div
              className="cal-ghost"
              style={{
                left: `${(gesture.day * 100) / 7}%`,
                width: `${100 / 7}%`,
                top: (gesture.fromMin - startMin) * PX_PER_MIN,
                height:
                  (gesture.kind === 'move'
                    ? gesture.length
                    : Math.max(MIN_DURATION, gesture.toMin - gesture.fromMin)) * PX_PER_MIN
              }}
            >
              <div className="cal-block-meta">
                {hhmmOf(gesture.fromMin)} –{' '}
                {hhmmOf(gesture.kind === 'move' ? gesture.fromMin + gesture.length : gesture.toMin)}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="cal-hint">
        Povuci po praznom da napraviš unos. Blok se pomera prevlačenjem, a donja ivica ga rasteže.
        Escape prekida.
        {hiddenCount > 0 && (
          <span className="cal-hidden">
            {' '}
            {pluralEntries(hiddenCount)} van prikazanog opsega sati — proširi ga u Podešavanjima.
          </span>
        )}
      </p>
    </div>
  )
}
