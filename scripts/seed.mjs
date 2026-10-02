/**
 * Ubacuje test podatke u bazu aplikacije.
 *
 *   npm run seed          # dodaje unose u postojecu bazu
 *   npm run seed -- --reset   # prvo obrise sve unose, pa ubaci
 *
 * Radi pod obicnim Nodeom (24+ ima ugradjeni node:sqlite). Aplikacija ne mora
 * da bude pokrenuta, ali ako jeste — zatvori je, da ne pise preko ovoga.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { SCHEMA_SQL, DEFAULT_PROJECTS } from '../src/shared/schema.ts'
import { dbFile, userDataDir } from './db-path.mjs'

const reset = process.argv.includes('--reset')

/** Dan sa pomerajem od danas, lokalno, sa zadatim sat:minut. */
function at(dayOffset, hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// [offset dana, opis, projekat, pocetak, kraj, naplativo, tagovi]
const ROWS = [
  [0, 'Ilustracije', 'p-acme', '13:00', '15:00', true, ['EUR', 'Fakturisano']],
  [0, 'Popravka baga #212', 'p-x', '09:30', '13:00', true, []],
  [0, 'Prijava poreza', 'p-office', '08:00', '09:30', false, ['Prekovremeno']],
  [-1, 'Razvoj nove funkcije', 'p-x', '15:00', '18:00', true, ['Prekovremeno']],
  [-1, 'Dizajn interfejsa', 'p-acme', '13:30', '15:00', true, []],
  [-1, 'Ručak', 'p-break', '13:00', '13:30', false, []],
  [-1, 'Obuka u firmi', 'p-office', '10:00', '13:00', false, []],
  [-1, '', null, '09:00', '10:00', false, []],
  [-2, 'Konsultacije', 'p-acme', '09:00', '13:00', true, []],
  [-2, 'Code review', 'p-x', '14:00', '19:30', true, []],
  [-3, 'Sastanak sa klijentom', 'p-acme', '10:00', '12:00', true, []],
  [-3, 'Implementacija izveštaja', 'p-x', '13:00', '20:30', true, []],
  [-8, 'Migracija baze', 'p-x', '09:00', '17:00', true, []],
  [-9, 'Priprema ponude', 'p-acme', '10:00', '14:30', true, ['EUR']]
]

mkdirSync(userDataDir(), { recursive: true })
const db = new DatabaseSync(dbFile())
db.exec(SCHEMA_SQL)

// Projekti moraju da postoje pre unosa (foreign key).
const insertProject = db.prepare(
  'INSERT OR IGNORE INTO projects (id, name, color, position) VALUES (?, ?, ?, ?)'
)
for (const p of DEFAULT_PROJECTS) insertProject.run(p.id, p.name, p.color, p.position)
db.exec('PRAGMA user_version = 1')

if (reset) {
  db.exec('DELETE FROM entry_tags')
  db.exec('DELETE FROM entries')
  db.exec('DELETE FROM running')
}

const insertEntry = db.prepare(
  `INSERT INTO entries (id, description, project_id, started_at, ended_at, billable)
   VALUES (?, ?, ?, ?, ?, ?)`
)
const insertTag = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)')

let n = 0
for (const [off, desc, project, start, end, billable, tags] of ROWS) {
  const id = `seed-${off}-${start.replace(':', '')}`
  insertEntry.run(id, desc, project, at(off, start), at(off, end), billable ? 1 : 0)
  for (const tag of tags) insertTag.run(id, tag)
  n++
}

const total = db.prepare('SELECT COUNT(*) AS c FROM entries').get().c
db.close()

console.log(`${dbFile()}`)
console.log(`${reset ? 'resetovano, ' : ''}ubaceno ${n} unosa — ukupno ${total} u bazi`)
