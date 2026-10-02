import type { Project } from '../../../shared/types'
import { IconPlayFilled, IconStopFilled } from './Icons'
import { fmtClock } from '../lib/time'

interface Props {
  desc: string
  onDesc: (v: string) => void
  projects: Project[]
  projectId: string | null
  onCycleProject: () => void
  billable: boolean
  onToggleBillable: () => void
  running: boolean
  elapsedSec: number
  onToggle: () => void
}

export default function TimerBar({
  desc,
  onDesc,
  projects,
  projectId,
  onCycleProject,
  billable,
  onToggleBillable,
  running,
  elapsedSec,
  onToggle
}: Props): React.JSX.Element {
  const project = projects.find((p) => p.id === projectId) ?? null

  return (
    <div className={`timer${running ? ' running' : ''}`}>
      <label htmlFor="tt-desc" className="sr-only">
        Na čemu radiš?
      </label>
      <input
        id="tt-desc"
        className="timer-desc"
        value={desc}
        onChange={(e) => onDesc(e.target.value)}
        placeholder="Na čemu radiš?"
      />

      <button className="chip" onClick={onCycleProject}>
        <span className="dot" style={{ background: project?.color ?? 'transparent' }} />
        {project?.name ?? 'Bez projekta'}
      </button>

      <button
        className={`bill-btn${billable ? ' on' : ''}`}
        onClick={onToggleBillable}
        aria-label="Naplativo"
        aria-pressed={billable}
      >
        $
      </button>

      <div className="vdivider" />

      {running && <span className="pulse" aria-hidden="true" />}

      <span className="clock">{fmtClock(elapsedSec)}</span>

      <button className={`start-btn${running ? ' stop' : ''}`} onClick={onToggle}>
        {running ? <IconStopFilled /> : <IconPlayFilled />}
        {running ? 'Zaustavi' : 'Start'}
      </button>
    </div>
  )
}
