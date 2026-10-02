import { DAY_LABELS, fmtMinutes } from '../lib/time'

export interface DayBucket {
  key: string
  minutes: number
  isToday: boolean
}

interface Props {
  days: DayBucket[]
}

/** Visina stupca je relativna na najveci dan u nedelji, ali ne manja od 9h
 *  da jedan kratak dan ne izgleda kao pun radni dan. */
const MIN_SCALE_MIN = 540

export default function WeekChart({ days }: Props): React.JSX.Element {
  const max = Math.max(MIN_SCALE_MIN, ...days.map((d) => d.minutes))

  return (
    <div className="chart">
      {days.map((d, i) => {
        const h = d.minutes > 0 ? Math.max(6, Math.round((d.minutes / max) * 56)) : 4
        const cls = d.minutes === 0 ? 'empty' : d.isToday ? 'today' : ''
        return (
          <div key={d.key} className={`chart-col${d.isToday ? ' is-today' : ''}`}>
            <div className="chart-slot">
              <div className={`chart-bar ${cls}`} style={{ height: `${h}px` }} />
            </div>
            <div className="chart-foot">
              <span className="label">{DAY_LABELS[i]}</span>
              <span className="total">{d.minutes > 0 ? fmtMinutes(d.minutes) : '—'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
