/**
 * Sema baze. Dele je aplikacija (src/main/db.ts) i seed skripta (scripts/),
 * da ne postoje dve verzije iste tabele.
 */

export const SCHEMA_VERSION = 2

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  color    TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
  id          TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  started_at  TEXT NOT NULL,
  ended_at    TEXT NOT NULL,
  billable    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_started ON entries(started_at);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag)
);

-- Uvek najvise jedan red (id = 1): timer koji trenutno radi.
CREATE TABLE IF NOT EXISTS running (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  description TEXT NOT NULL DEFAULT '',
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  billable    INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL
);

-- Kljuc-vrednost; vrednosti su JSON, da ne pravimo kolonu po podesavanju.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

/**
 * Projekti koje dobija prazna baza. Unosa nema — prva instalacija je prazna.
 * Test podaci se ubacuju odvojeno, sa `npm run seed`.
 */
export const DEFAULT_PROJECTS = [
  { id: 'p-acme', name: 'ACME', color: '#2F6FEB', position: 0 },
  { id: 'p-x', name: 'Projekat X', color: '#8B5CF6', position: 1 },
  { id: 'p-office', name: 'Kancelarija', color: '#D97706', position: 2 },
  { id: 'p-break', name: 'Pauza', color: '#8A8A90', position: 3 }
]

/** Podrazumevana podesavanja. Vrednost je JSON string. */
export const DEFAULT_SETTINGS: Record<string, string> = {
  weeklyGoalMinutes: '2400',
  dayStartHour: '6',
  dayEndHour: '22'
}

/** Paleta za izbor boje projekta. */
export const PROJECT_COLORS = [
  '#2F6FEB',
  '#8B5CF6',
  '#D97706',
  '#1F6F5C',
  '#C2410C',
  '#B91C1C',
  '#0E7490',
  '#A16207',
  '#7C3AED',
  '#8A8A90'
]
