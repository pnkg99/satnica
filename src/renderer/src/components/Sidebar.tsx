import { IconCalendar, IconChart, IconClock, IconFolder, IconLogo, IconSettings } from './Icons'
import { fmtMinutes } from '../lib/time'

export type View = 'track' | 'calendar' | 'reports' | 'projects' | 'settings'

const ITEMS: { id: View; label: string; icon: (props: { size?: number }) => React.JSX.Element }[] = [
  { id: 'track', label: 'Praćenje vremena', icon: IconClock },
  { id: 'calendar', label: 'Kalendar', icon: IconCalendar },
  { id: 'reports', label: 'Izveštaji', icon: IconChart },
  { id: 'projects', label: 'Projekti', icon: IconFolder }
]

interface Props {
  view: View
  onView: (v: View) => void
  weekMinutes: number
  /** Nedeljni cilj; dolazi iz podesavanja. */
  goalMinutes: number
}

export default function Sidebar({ view, onView, weekMinutes, goalMinutes }: Props): React.JSX.Element {
  const pct = goalMinutes <= 0 ? 0 : Math.min(100, Math.round((weekMinutes / goalMinutes) * 100))

  return (
    <nav className="sidebar" aria-label="Glavna navigacija">
      <div className="brand">
        <div className="brand-mark">
          <IconLogo />
        </div>
        <span className="brand-name">Satnica</span>
      </div>

      <div className="nav">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${view === item.id ? ' active' : ''}`}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onView(item.id)}
          >
            <item.icon />
            {item.label}
          </button>
        ))}
      </div>

      <div className="spacer" />

      <div className="week-box">
        <div className="week-box-label">Ova nedelja</div>
        <div className="week-box-value">
          <strong>{fmtMinutes(weekMinutes)}</strong>
          <span>/ {fmtMinutes(goalMinutes)}</span>
        </div>
        <div
          className="week-box-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Napredak nedeljnog cilja"
        >
          <div className="week-box-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button
        className={`nav-item${view === 'settings' ? ' active' : ''}`}
        aria-current={view === 'settings' ? 'page' : undefined}
        onClick={() => onView('settings')}
      >
        <IconSettings />
        Podešavanja
      </button>
    </nav>
  )
}
