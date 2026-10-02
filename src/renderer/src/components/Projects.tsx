import { useEffect, useRef, useState } from 'react'
import type { ProjectWithTotals } from '../../../shared/types'
import { PROJECT_COLORS } from '../../../shared/schema'
import { IconTrash } from './Icons'
import { fmtMinutes, pluralEntries } from '../lib/time'
import { useDebouncedWrite } from '../lib/useData'

interface Props {
  /** Zove se posle svake izmene, da ostatak aplikacije osvezi listu projekata. */
  onChanged: () => void
}

export default function Projects({ onChanged }: Props): React.JSX.Element {
  const [rows, setRows] = useState<ProjectWithTotals[]>([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [openColorId, setOpenColorId] = useState<string | null>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const writeLater = useDebouncedWrite()

  // Paleta se zatvara klikom bilo gde van nje.
  useEffect(() => {
    if (openColorId === null) return
    function onDown(ev: MouseEvent): void {
      if (!paletteRef.current?.contains(ev.target as Node)) setOpenColorId(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [openColorId])

  function refresh(): void {
    window.api.listProjectTotals().then(setRows)
  }

  useEffect(refresh, [])

  async function add(): Promise<void> {
    const name = newName.trim()
    if (name === '') return
    await window.api.createProject(name, newColor)
    setNewName('')
    setNewColor(PROJECT_COLORS[(PROJECT_COLORS.indexOf(newColor) + 1) % PROJECT_COLORS.length])
    refresh()
    onChanged()
  }

  function rename(id: string, name: string): void {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)))
    writeLater(id, async () => {
      await window.api.updateProject(id, { name })
      onChanged()
    })
  }

  async function recolor(id: string, color: string): Promise<void> {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, color } : r)))
    setOpenColorId(null)
    await window.api.updateProject(id, { color })
    onChanged()
  }

  async function remove(id: string): Promise<void> {
    await window.api.deleteProject(id)
    setConfirmId(null)
    refresh()
    onChanged()
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Novi projekat</h2>
        </div>
        <div className="proj-new">
          <button
            className="swatch lg"
            style={{ background: newColor }}
            aria-label="Boja novog projekta"
            onClick={() =>
              setNewColor(PROJECT_COLORS[(PROJECT_COLORS.indexOf(newColor) + 1) % PROJECT_COLORS.length])
            }
          />
          <input
            className="text-input"
            value={newName}
            placeholder="Ime projekta"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
          />
          <button className="btn primary" onClick={add} disabled={newName.trim() === ''}>
            Dodaj
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Projekti</h2>
          <span className="card-note">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="card-empty">Nema projekata.</div>
        ) : (
          rows.map((p) => (
            <div key={p.id} className="proj-row">
              <div className="swatch-wrap">
                <button
                  className="swatch"
                  style={{ background: p.color }}
                  aria-label={`Boja projekta ${p.name}`}
                  onClick={() => setOpenColorId(openColorId === p.id ? null : p.id)}
                />
                {openColorId === p.id && (
                  <div className="palette" ref={paletteRef}>
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        className="swatch sm"
                        style={{ background: c }}
                        aria-label={c}
                        onClick={() => recolor(p.id, c)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <input
                className="proj-name"
                value={p.name}
                aria-label="Ime projekta"
                onChange={(e) => rename(p.id, e.target.value)}
              />

              <span className="proj-count">{pluralEntries(p.entryCount)}</span>
              <span className="proj-billable mono">{fmtMinutes(Math.round(p.billableMinutes))}</span>
              <span className="proj-total mono">{fmtMinutes(Math.round(p.minutes))}</span>

              {confirmId === p.id ? (
                <div className="confirm">
                  <button className="btn danger sm" onClick={() => remove(p.id)}>
                    Obriši
                  </button>
                  <button className="btn sm" onClick={() => setConfirmId(null)}>
                    Odustani
                  </button>
                </div>
              ) : (
                <button
                  className="row-icon small"
                  aria-label={`Obriši projekat ${p.name}`}
                  onClick={() => setConfirmId(p.id)}
                >
                  <IconTrash />
                </button>
              )}
            </div>
          ))
        )}
        <div className="card-foot">
          Brisanje projekta ne briše unose — oni ostaju bez projekta.
        </div>
      </div>
    </>
  )
}
