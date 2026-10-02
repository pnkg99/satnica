import { useMemo } from 'react'
import type { Project, TimeEntry } from '../../../shared/types'
import { DAY_LABELS, addDays, dayKey, durationMinutes, fmtMinutes } from '../lib/time'

export type PeriodId = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'last30'

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'thisWeek', label: 'Ova nedelja' },
  { id: 'lastWeek', label: 'Prošla nedelja' },
  { id: 'thisMonth', label: 'Ovaj mesec' },
  { id: 'last30', label: 'Poslednjih 30 dana' }
]

interface Props {
  entries: TimeEntry[]
  projects: Project[]
  from: Date
  to: Date
  period: PeriodId
  onPeriod: (p: PeriodId) => void
}

export default function Reports({ entries, projects, from, to, period, onPeriod }: Props): React.JSX.Element {
  const report = useMemo(() => {
    let total = 0
    let billable = 0
    const perProject = new Map<string, { minutes: number; billable: number; count: number }>()
    const perDay = new Map<string, number>()

    for (const e of entries) {
      const min = durationMinutes(e.start, e.end)
      total += min
      if (e.billable) billable += min

      const key = e.projectId ?? '__none'
      const slot = perProject.get(key) ?? { minutes: 0, billable: 0, count: 0 }
      slot.minutes += min
      if (e.billable) slot.billable += min
      slot.count += 1
      perProject.set(key, slot)

      const day = dayKey(e.start)
      perDay.set(day, (perDay.get(day) ?? 0) + min)
    }

    const rows = [...perProject.entries()]
      .map(([id, v]) => {
        const project = projects.find((p) => p.id === id) ?? null
        return {
          id,
          name: project?.name ?? 'Bez projekta',
          color: project?.color ?? '#B9B8B2',
          ...v,
          share: total === 0 ? 0 : v.minutes / total
        }
      })
      .sort((a, b) => b.minutes - a.minutes)

    // Dani u opsegu — i oni bez unosa, da grafik ne bude krnj.
    const days: { key: string; label: string; minutes: number }[] = []
    for (let d = new Date(from); d < to; d = addDays(d, 1)) {
      const key = dayKey(d)
      days.push({ key, label: DAY_LABELS[(d.getDay() + 6) % 7], minutes: perDay.get(key) ?? 0 })
    }

    const workedDays = days.filter((d) => d.minutes > 0).length

    return { total, billable, rows, days, workedDays }
  }, [entries, projects, from, to])

  const maxDay = Math.max(60, ...report.days.map((d) => d.minutes))
  const compact = report.days.length > 14

  return (
    <>
      <div className="seg">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`seg-btn${period === p.id ? ' active' : ''}`}
            onClick={() => onPeriod(p.id)}
            aria-pressed={period === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="stat-row">
        <Stat label="Ukupno" value={fmtMinutes(report.total)} />
        <Stat label="Naplativo" value={fmtMinutes(report.billable)} accent />
        <Stat label="Nije naplativo" value={fmtMinutes(report.total - report.billable)} />
        <Stat label="Dana sa unosom" value={String(report.workedDays)} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Po danima</h2>
        </div>
        <div className={`rep-chart${compact ? ' compact' : ''}`}>
          {report.days.map((d) => (
            <div key={d.key} className="rep-col" title={`${d.key}: ${fmtMinutes(d.minutes)}`}>
              <div className="rep-slot">
                <div
                  className={`rep-bar${d.minutes === 0 ? ' empty' : ''}`}
                  style={{ height: d.minutes === 0 ? 4 : Math.max(6, (d.minutes / maxDay) * 120) }}
                />
              </div>
              {!compact && <span className="rep-label">{d.label}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Po projektima</h2>
          <span className="card-note">{report.rows.length} stavki</span>
        </div>
        {report.rows.length === 0 ? (
          <div className="card-empty">Nema unosa u ovom periodu.</div>
        ) : (
          report.rows.map((r) => (
            <div key={r.id} className="rep-row">
              <span className="dot" style={{ background: r.color }} />
              <span className="rep-name">{r.name}</span>
              <div className="rep-track">
                <div className="rep-fill" style={{ width: `${r.share * 100}%`, background: r.color }} />
              </div>
              <span className="rep-share mono">{Math.round(r.share * 100)}%</span>
              <span className="rep-billable mono">{fmtMinutes(r.billable)}</span>
              <span className="rep-total mono">{fmtMinutes(r.minutes)}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono${accent ? ' accent' : ''}`}>{value}</span>
    </div>
  )
}
