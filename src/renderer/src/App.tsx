import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TimeEntry } from '../../shared/types'
import Sidebar, { type View } from './components/Sidebar'
import TimerBar from './components/TimerBar'
import WeekChart, { type DayBucket } from './components/WeekChart'
import EntryGroup from './components/EntryGroup'
import Calendar from './components/Calendar'
import Reports, { type PeriodId } from './components/Reports'
import Projects from './components/Projects'
import Settings from './components/Settings'
import { IconChevronLeft, IconChevronRight } from './components/Icons'
import { useDebouncedWrite, useProjects, useSettings, useTick, useWeek } from './lib/useData'
import {
  addDays,
  addMonths,
  dayKey,
  durationMinutes,
  fmtGroupTitle,
  fmtLongDate,
  fmtWeekRange,
  startOfMonth,
  startOfWeek
} from './lib/time'

const VIEW_TITLES: Record<View, string> = {
  track: 'Praćenje vremena',
  calendar: 'Kalendar',
  reports: 'Izveštaji',
  projects: 'Projekti',
  settings: 'Podešavanja'
}

/** Izabrani period izvestaja -> [od, do). */
function periodRange(period: PeriodId): { from: Date; to: Date } {
  const today = new Date()
  const thisMonday = startOfWeek(today)
  switch (period) {
    case 'thisWeek':
      return { from: thisMonday, to: addDays(thisMonday, 7) }
    case 'lastWeek':
      return { from: addDays(thisMonday, -7), to: thisMonday }
    case 'thisMonth': {
      const first = startOfMonth(today)
      return { from: first, to: addMonths(first, 1) }
    }
    default: {
      const start = new Date(today)
      start.setHours(0, 0, 0, 0)
      return { from: addDays(start, -29), to: addDays(start, 1) }
    }
  }
}

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('track')
  const [weekOffset, setWeekOffset] = useState(0)
  const [period, setPeriod] = useState<PeriodId>('thisWeek')
  const [draft, setDraft] = useState({ desc: '', projectId: null as string | null, billable: true })

  // macOS dobija skrivenu naslovnu traku, pa i drugaciji padding sidebara.
  useEffect(() => {
    window.api.platform().then((p) => {
      if (p === 'darwin') document.body.classList.add('mac')
    })
  }, [])

  const monday = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset])
  const currentMonday = useMemo(() => startOfWeek(new Date()), [])
  const report = useMemo(() => periodRange(period), [period])

  // Kalendar i Pracenje gledaju izabranu nedelju; Izvestaji svoj period.
  const visible = view === 'reports' ? report : { from: monday, to: addDays(monday, 7) }

  const range = useMemo(
    () => ({
      from: visible.from.toISOString(),
      to: visible.to.toISOString(),
      currentFrom: currentMonday.toISOString(),
      currentTo: addDays(currentMonday, 7).toISOString()
    }),
    [visible.from, visible.to, currentMonday]
  )

  const { projects, reloadProjects } = useProjects()
  const { settings, setSetting } = useSettings()
  const { entries, running, currentWeekMinutes, reload, loading, patchLocal, setRunningLocal } = useWeek(
    range.from,
    range.to,
    range.currentFrom,
    range.currentTo
  )
  const writeLater = useDebouncedWrite()

  const now = useTick(running !== null)
  const elapsedSec =
    running === null ? 0 : Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000))
  const runningMin = Math.floor(elapsedSec / 60)

  const { days, groups } = useMemo(() => {
    const todayKey = dayKey(new Date())
    const buckets: DayBucket[] = []
    const byDay = new Map<string, TimeEntry[]>()
    for (let i = 0; i < 7; i++) {
      const key = dayKey(addDays(monday, i))
      buckets.push({ key, minutes: 0, isToday: key === todayKey })
      byDay.set(key, [])
    }

    for (const e of entries) {
      const key = dayKey(e.start)
      const list = byDay.get(key)
      if (list === undefined) continue
      list.push(e)
      const bucket = buckets.find((b) => b.key === key)
      if (bucket !== undefined) bucket.minutes += durationMinutes(e.start, e.end)
    }

    // Timer koji radi ulazi u danasnji dan, ako je danas u prikazanoj nedelji.
    const todayBucket = buckets.find((b) => b.isToday)
    if (todayBucket !== undefined) todayBucket.minutes += runningMin

    const dayGroups = buckets
      .slice()
      .reverse()
      .map((b) => ({
        key: b.key,
        title: fmtGroupTitle(new Date(`${b.key}T00:00:00`)),
        entries: byDay.get(b.key) ?? []
      }))
      .filter((g) => g.entries.length > 0)

    return { days: buckets, groups: dayGroups }
  }, [entries, monday, runningMin])

  const startTimer = useCallback(
    async (desc: string, projectId: string | null, billable: boolean): Promise<void> => {
      await window.api.startRunning(desc, projectId, billable)
      reload()
    },
    [reload]
  )

  async function toggleTimer(): Promise<void> {
    if (running !== null) {
      await window.api.stopRunning()
      setDraft((d) => ({ ...d, desc: '' }))
      reload()
    } else {
      await startTimer(draft.desc, draft.projectId, draft.billable)
    }
  }

  function setDesc(v: string): void {
    if (running !== null) {
      setRunningLocal({ desc: v })
      writeLater('running', () => window.api.updateRunning({ desc: v }))
    } else {
      setDraft((d) => ({ ...d, desc: v }))
    }
  }

  function cycleProject(): void {
    const ids: (string | null)[] = [null, ...projects.map((p) => p.id)]
    const current = running !== null ? running.projectId : draft.projectId
    const next = ids[(ids.indexOf(current) + 1) % ids.length]
    if (running !== null) {
      setRunningLocal({ projectId: next })
      window.api.updateRunning({ projectId: next })
    } else {
      setDraft((d) => ({ ...d, projectId: next }))
    }
  }

  function toggleBillable(): void {
    if (running !== null) {
      const next = !running.billable
      setRunningLocal({ billable: next })
      window.api.updateRunning({ billable: next })
    } else {
      setDraft((d) => ({ ...d, billable: !d.billable }))
    }
  }

  const deleteEntry = useCallback(
    async (id: string) => {
      await window.api.deleteEntry(id)
      reload()
    },
    [reload]
  )

  const editDesc = useCallback(
    (id: string, desc: string) => {
      patchLocal(id, { desc })
      writeLater(id, () => window.api.updateEntry(id, { desc }))
    },
    [patchLocal, writeLater]
  )

  const toggleEntryBillable = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id)
      if (entry === undefined) return
      patchLocal(id, { billable: !entry.billable })
      window.api.updateEntry(id, { billable: !entry.billable })
    },
    [entries, patchLocal]
  )

  const resumeEntry = useCallback(
    (e: TimeEntry) => startTimer(e.desc, e.projectId, e.billable),
    [startTimer]
  )

  const createFromCalendar = useCallback(
    async (start: Date, end: Date) => {
      await window.api.createEntry({
        desc: '',
        projectId: draft.projectId,
        start: start.toISOString(),
        end: end.toISOString(),
        billable: draft.billable,
        tags: []
      })
      reload()
    },
    [draft.projectId, draft.billable, reload]
  )

  const moveFromCalendar = useCallback(
    async (id: string, start: Date, end: Date) => {
      patchLocal(id, { start: start.toISOString(), end: end.toISOString() })
      await window.api.updateEntry(id, { start: start.toISOString(), end: end.toISOString() })
      reload()
    },
    [patchLocal, reload]
  )

  const openTrack = useCallback(() => setView('track'), [])

  const goalMinutes = Number(settings.weeklyGoalMinutes ?? 2400)
  const dayStartHour = Number(settings.dayStartHour ?? 6)
  const dayEndHour = Number(settings.dayEndHour ?? 22)
  const showWeekNav = view === 'track' || view === 'calendar'

  return (
    <div className="app">
      <Sidebar
        view={view}
        onView={setView}
        weekMinutes={currentWeekMinutes + runningMin}
        goalMinutes={goalMinutes}
      />

      <main className="main">
        <div className="page-head">
          <div>
            <div className="eyebrow">{fmtLongDate(new Date())}</div>
            <h1>{VIEW_TITLES[view]}</h1>
          </div>
          {showWeekNav && (
            <div className="week-nav">
              <button
                className="icon-btn"
                aria-label="Prethodna nedelja"
                onClick={() => setWeekOffset((w) => w - 1)}
              >
                <IconChevronLeft />
              </button>
              <button className="week-range" onClick={() => setWeekOffset(0)} title="Nazad na ovu nedelju">
                {fmtWeekRange(monday)}
              </button>
              <button
                className="icon-btn"
                aria-label="Sledeća nedelja"
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                <IconChevronRight />
              </button>
            </div>
          )}
        </div>

        {view === 'track' && (
          <>
            <TimerBar
              desc={running !== null ? running.desc : draft.desc}
              onDesc={setDesc}
              projects={projects}
              projectId={running !== null ? running.projectId : draft.projectId}
              onCycleProject={cycleProject}
              billable={running !== null ? running.billable : draft.billable}
              onToggleBillable={toggleBillable}
              running={running !== null}
              elapsedSec={elapsedSec}
              onToggle={toggleTimer}
            />

            <WeekChart days={days} />

            {groups.length === 0 ? (
              <div className="empty-state">
                {loading ? '' : 'Nema unosa u ovoj nedelji. Pokreni timer da napraviš prvi.'}
              </div>
            ) : (
              groups.map((g) => (
                <EntryGroup
                  key={g.key}
                  title={g.title}
                  entries={g.entries}
                  projects={projects}
                  onResume={resumeEntry}
                  onDelete={deleteEntry}
                  onDesc={editDesc}
                  onToggleBillable={toggleEntryBillable}
                />
              ))
            )}
          </>
        )}

        {view === 'calendar' && (
          <Calendar
            monday={monday}
            entries={entries}
            projects={projects}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            onCreate={createFromCalendar}
            onMove={moveFromCalendar}
            onSelect={openTrack}
          />
        )}

        {view === 'reports' && (
          <Reports
            entries={entries}
            projects={projects}
            from={report.from}
            to={report.to}
            period={period}
            onPeriod={setPeriod}
          />
        )}

        {view === 'projects' && (
          <Projects
            onChanged={() => {
              reloadProjects()
              reload()
            }}
          />
        )}

        {view === 'settings' && <Settings settings={settings} onSet={setSetting} />}
      </main>
    </div>
  )
}
