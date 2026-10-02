import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { EntryPatch, Project, ProjectWithTotals, RunningTimer, TimeEntry } from '../shared/types'
import { DEFAULT_PROJECTS, DEFAULT_SETTINGS, SCHEMA_SQL, SCHEMA_VERSION } from '../shared/schema'

/**
 * SQLite preko ugradjenog node:sqlite modula (Node 24 u Electronu 44).
 * Nema native zavisnosti, pa nema ni @electron/rebuild — isti kod radi
 * na Windows, Linux i macOS bez ijednog dodatnog koraka pri pakovanju.
 */
let db: DatabaseSync | null = null

export function dbPath(): string {
  return join(app.getPath('userData'), 'satnica.db')
}

export function open(): DatabaseSync {
  if (db !== null) return db

  const file = dbPath()
  mkdirSync(app.getPath('userData'), { recursive: true })
  db = new DatabaseSync(file)
  db.exec(SCHEMA_SQL)

  migrate(db)
  return db
}

/**
 * CREATE TABLE IF NOT EXISTS gore vec napravi sve tabele, pa migracija samo
 * dopunjava podatke koje stariji fajl nema. Verzija stoji u PRAGMA user_version.
 */
function migrate(conn: DatabaseSync): void {
  const { user_version: from } = conn.prepare('PRAGMA user_version').get() as { user_version: number }
  if (from >= SCHEMA_VERSION) return

  if (from === 0) {
    // Prazna baza dobija samo projekte; unosa nema.
    const insert = conn.prepare('INSERT OR IGNORE INTO projects (id, name, color, position) VALUES (?, ?, ?, ?)')
    for (const p of DEFAULT_PROJECTS) insert.run(p.id, p.name, p.color, p.position)
  }

  // v2 je uveo settings — i nova i stara baza dobijaju podrazumevane vrednosti.
  const setting = conn.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) setting.run(key, value)

  conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

export function close(): void {
  db?.close()
  db = null
}

/* ---------- mapiranje redova ---------- */

interface EntryRow {
  id: string
  description: string
  project_id: string | null
  started_at: string
  ended_at: string
  billable: number
}

function toEntry(row: EntryRow, tags: string[]): TimeEntry {
  return {
    id: row.id,
    desc: row.description,
    projectId: row.project_id,
    start: row.started_at,
    end: row.ended_at,
    billable: row.billable === 1,
    tags
  }
}

/** Tagove citamo jednim upitom za ceo opseg, ne po unosu. */
function tagsFor(ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (ids.length === 0) return map
  const holes = ids.map(() => '?').join(', ')
  const rows = open()
    .prepare(`SELECT entry_id, tag FROM entry_tags WHERE entry_id IN (${holes}) ORDER BY tag`)
    .all(...ids) as { entry_id: string; tag: string }[]
  for (const r of rows) {
    const list = map.get(r.entry_id)
    if (list === undefined) map.set(r.entry_id, [r.tag])
    else list.push(r.tag)
  }
  return map
}

/* ---------- projekti ---------- */

export function listProjects(): Project[] {
  return open()
    .prepare('SELECT id, name, color FROM projects ORDER BY position, name')
    .all() as unknown as Project[]
}

/** Projekti sa ukupnim i naplativim minutima — za ekran Projekti. */
export function listProjectsWithTotals(): ProjectWithTotals[] {
  return open()
    .prepare(
      `SELECT p.id, p.name, p.color,
              COALESCE(SUM((julianday(e.ended_at) - julianday(e.started_at)) * 1440), 0) AS minutes,
              COALESCE(SUM(CASE WHEN e.billable = 1
                                THEN (julianday(e.ended_at) - julianday(e.started_at)) * 1440
                                ELSE 0 END), 0) AS billableMinutes,
              COUNT(e.id) AS entryCount
       FROM projects p
       LEFT JOIN entries e ON e.project_id = p.id
       GROUP BY p.id
       ORDER BY p.position, p.name`
    )
    .all() as unknown as ProjectWithTotals[]
}

export function createProject(name: string, color: string): Project {
  const conn = open()
  const id = `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const { next } = conn.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM projects').get() as {
    next: number
  }
  conn.prepare('INSERT INTO projects (id, name, color, position) VALUES (?, ?, ?, ?)').run(id, name, color, next)
  return { id, name, color }
}

export function updateProject(id: string, patch: { name?: string; color?: string }): void {
  const sets: string[] = []
  const values: string[] = []
  if (patch.name !== undefined) {
    sets.push('name = ?')
    values.push(patch.name)
  }
  if (patch.color !== undefined) {
    sets.push('color = ?')
    values.push(patch.color)
  }
  if (sets.length === 0) return
  values.push(id)
  open().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/** Brise projekat; unosi ostaju, project_id im ide na NULL (ON DELETE SET NULL). */
export function deleteProject(id: string): void {
  open().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

/* ---------- podesavanja ---------- */

export function getSettings(): Record<string, string> {
  const rows = open().prepare('SELECT key, value FROM settings').all() as unknown as {
    key: string
    value: string
  }[]
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export function setSetting(key: string, value: string): void {
  open()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

/* ---------- unosi ---------- */

/** Unosi koji pocinju u [from, to). Granice su ISO stringovi. */
export function listEntries(from: string, to: string): TimeEntry[] {
  const rows = open()
    .prepare(
      `SELECT id, description, project_id, started_at, ended_at, billable
       FROM entries WHERE started_at >= ? AND started_at < ?
       ORDER BY started_at DESC`
    )
    .all(from, to) as unknown as EntryRow[]
  const tags = tagsFor(rows.map((r) => r.id))
  return rows.map((r) => toEntry(r, tags.get(r.id) ?? []))
}

/** Ukupno minuta u opsegu — za brojac u sidebaru, bez vucenja svih redova. */
export function minutesIn(from: string, to: string): number {
  const row = open()
    .prepare(
      `SELECT COALESCE(SUM((julianday(ended_at) - julianday(started_at)) * 1440), 0) AS mins
       FROM entries WHERE started_at >= ? AND started_at < ?`
    )
    .get(from, to) as { mins: number }
  return Math.round(row.mins)
}

export function createEntry(e: Omit<TimeEntry, 'id'> & { id?: string }): TimeEntry {
  const id = e.id ?? `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  const conn = open()
  conn
    .prepare(
      `INSERT INTO entries (id, description, project_id, started_at, ended_at, billable)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, e.desc, e.projectId, e.start, e.end, e.billable ? 1 : 0)
  if (e.tags.length > 0) {
    const insert = conn.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)')
    for (const tag of e.tags) insert.run(id, tag)
  }
  return { ...e, id }
}

const PATCH_COLUMNS: Record<keyof EntryPatch, string> = {
  desc: 'description',
  projectId: 'project_id',
  billable: 'billable',
  start: 'started_at',
  end: 'ended_at'
}

export function updateEntry(id: string, patch: EntryPatch): void {
  const sets: string[] = []
  const values: (string | number | null)[] = []
  for (const key of Object.keys(patch) as (keyof EntryPatch)[]) {
    const value = patch[key]
    if (value === undefined) continue
    sets.push(`${PATCH_COLUMNS[key]} = ?`)
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
  }
  if (sets.length === 0) return
  values.push(id)
  open().prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteEntry(id: string): void {
  open().prepare('DELETE FROM entries WHERE id = ?').run(id)
}

/* ---------- timer ---------- */

export function getRunning(): RunningTimer | null {
  const row = open()
    .prepare('SELECT description, project_id, billable, started_at FROM running WHERE id = 1')
    .get() as { description: string; project_id: string | null; billable: number; started_at: string } | undefined
  if (row === undefined) return null
  return {
    desc: row.description,
    projectId: row.project_id,
    billable: row.billable === 1,
    startedAt: row.started_at
  }
}

/** Zaustavlja timer i upisuje ga kao unos. Vraca unos, ili null ako nista nije radilo. */
export function stopRunning(): TimeEntry | null {
  const running = getRunning()
  if (running === null) return null
  const entry = createEntry({
    desc: running.desc.trim(),
    projectId: running.projectId,
    start: running.startedAt,
    end: new Date().toISOString(),
    billable: running.billable,
    tags: []
  })
  open().prepare('DELETE FROM running WHERE id = 1').run()
  return entry
}

/** Pokrece novi timer; ako jedan vec radi, prvo ga zaustavi i sacuva. */
export function startRunning(desc: string, projectId: string | null, billable: boolean): void {
  stopRunning()
  open()
    .prepare(
      `INSERT INTO running (id, description, project_id, billable, started_at)
       VALUES (1, ?, ?, ?, ?)`
    )
    .run(desc, projectId, billable ? 1 : 0, new Date().toISOString())
}

/** Izmena timera dok radi (opis, projekat, naplativost). */
export function updateRunning(patch: Partial<Omit<RunningTimer, 'startedAt'>>): void {
  const sets: string[] = []
  const values: (string | number | null)[] = []
  if (patch.desc !== undefined) {
    sets.push('description = ?')
    values.push(patch.desc)
  }
  if (patch.projectId !== undefined) {
    sets.push('project_id = ?')
    values.push(patch.projectId)
  }
  if (patch.billable !== undefined) {
    sets.push('billable = ?')
    values.push(patch.billable ? 1 : 0)
  }
  if (sets.length === 0) return
  open().prepare(`UPDATE running SET ${sets.join(', ')} WHERE id = 1`).run(...values)
}
