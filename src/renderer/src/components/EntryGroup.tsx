import { memo } from 'react'
import type { Project, TimeEntry } from '../../../shared/types'
import { IconPlayOutline, IconTrash } from './Icons'
import { durationMinutes, fmtMinutes, hhmm } from '../lib/time'

interface GroupProps {
  title: string
  entries: TimeEntry[]
  projects: Project[]
  onResume: (e: TimeEntry) => void
  onDelete: (id: string) => void
  onDesc: (id: string, desc: string) => void
  onToggleBillable: (id: string) => void
}

function EntryGroup({
  title,
  entries,
  projects,
  onResume,
  onDelete,
  onDesc,
  onToggleBillable
}: GroupProps): React.JSX.Element {
  const total = entries.reduce((sum, e) => sum + durationMinutes(e.start, e.end), 0)

  return (
    <section className="group">
      <div className="group-head">
        <h2>{title}</h2>
        <div className="group-total">
          <span>Ukupno</span>
          <strong>{fmtMinutes(total)}</strong>
        </div>
      </div>
      {entries.map((e) => (
        <Row
          key={e.id}
          entry={e}
          project={projects.find((p) => p.id === e.projectId) ?? null}
          onResume={onResume}
          onDelete={onDelete}
          onDesc={onDesc}
          onToggleBillable={onToggleBillable}
        />
      ))}
    </section>
  )
}

export default memo(EntryGroup)

interface RowProps {
  entry: TimeEntry
  project: Project | null
  onResume: (e: TimeEntry) => void
  onDelete: (id: string) => void
  onDesc: (id: string, desc: string) => void
  onToggleBillable: (id: string) => void
}

function Row({ entry, project, onResume, onDelete, onDesc, onToggleBillable }: RowProps): React.JSX.Element {
  return (
    <div className="row">
      <div className="row-main">
        <input
          className={`row-desc${entry.desc ? '' : ' empty'}`}
          value={entry.desc}
          placeholder="Bez opisa"
          aria-label="Opis unosa"
          onChange={(ev) => onDesc(entry.id, ev.target.value)}
        />
        {project !== null && (
          <span className="row-project">
            <span className="dot" style={{ background: project.color }} />
            {project.name}
          </span>
        )}
      </div>

      <div className="row-tags">
        {entry.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>

      <button
        className={`row-bill${entry.billable ? ' on' : ''}`}
        onClick={() => onToggleBillable(entry.id)}
        aria-label={entry.billable ? 'Naplativo' : 'Nije naplativo'}
        aria-pressed={entry.billable}
      >
        $
      </button>

      <span className="row-range">
        {hhmm(entry.start)} – {hhmm(entry.end)}
      </span>
      <span className="row-dur">{fmtMinutes(durationMinutes(entry.start, entry.end))}</span>

      <button className="row-icon" onClick={() => onResume(entry)} aria-label="Nastavi ovaj unos">
        <IconPlayOutline />
      </button>
      <button className="row-icon small" onClick={() => onDelete(entry.id)} aria-label="Obriši unos">
        <IconTrash />
      </button>
    </div>
  )
}
