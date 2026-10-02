import { useEffect, useState } from 'react'

interface Props {
  settings: Record<string, string>
  onSet: (key: string, value: string) => void
}

const HOURS = Array.from({ length: 25 }, (_, i) => i)

export default function Settings({ settings, onSet }: Props): React.JSX.Element {
  const [dbPath, setDbPath] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.dbPath().then(setDbPath)
    window.api.version().then(setVersion)
  }, [])

  const goalHours = Math.round(Number(settings.weeklyGoalMinutes ?? 2400) / 60)
  const dayStart = Number(settings.dayStartHour ?? 6)
  const dayEnd = Number(settings.dayEndHour ?? 22)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Praćenje</h2>
        </div>

        <div className="set-row">
          <div className="set-text">
            <strong>Nedeljni cilj</strong>
            <span>Traka u levoj koloni meri napredak prema ovom broju.</span>
          </div>
          <div className="set-control">
            <input
              className="num-input"
              type="number"
              min={1}
              max={168}
              value={goalHours}
              aria-label="Nedeljni cilj u satima"
              onChange={(e) => {
                const h = Math.min(168, Math.max(1, Number(e.target.value) || 1))
                onSet('weeklyGoalMinutes', String(h * 60))
              }}
            />
            <span className="set-unit">sati</span>
          </div>
        </div>

        <div className="set-row">
          <div className="set-text">
            <strong>Vidljivi sati u kalendaru</strong>
            <span>Opseg koji kalendar prikazuje. Unosi izvan njega se ne vide.</span>
          </div>
          <div className="set-control">
            <select
              className="select"
              value={dayStart}
              aria-label="Početni sat"
              onChange={(e) => onSet('dayStartHour', e.target.value)}
            >
              {HOURS.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="set-unit">do</span>
            <select
              className="select"
              value={dayEnd}
              aria-label="Krajnji sat"
              onChange={(e) => onSet('dayEndHour', e.target.value)}
            >
              {HOURS.filter((h) => h > dayStart).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Podaci</h2>
        </div>
        <div className="set-row">
          <div className="set-text">
            <strong>Baza</strong>
            <span className="path">{dbPath}</span>
          </div>
          <div className="set-control">
            <button className="btn" onClick={() => window.api.revealDb()}>
              Otvori folder
            </button>
          </div>
        </div>
        <div className="card-foot">
          Test podaci se ubacuju komandom <code>npm run seed</code>, a baza se briše sa{' '}
          <code>npm run db:reset</code>. Aplikacija mora da bude zatvorena.
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>O aplikaciji</h2>
        </div>
        <div className="set-row">
          <div className="set-text">
            <strong>Satnica {version}</strong>
            <span>Prototip. Electron + React + SQLite.</span>
          </div>
        </div>
      </div>
    </>
  )
}
