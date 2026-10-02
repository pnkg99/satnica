/**
 * Brise bazu aplikacije. Sledece pokretanje je pravi prvi start:
 * prazna baza sa samo podrazumevanim projektima.
 *
 *   npm run db:reset
 */
import { rmSync, existsSync } from 'node:fs'
import { dbFile } from './db-path.mjs'

const file = dbFile()
let removed = 0

// WAL rezim ostavlja i -wal i -shm pored glavnog fajla.
for (const suffix of ['', '-wal', '-shm']) {
  const path = file + suffix
  if (!existsSync(path)) continue
  try {
    rmSync(path)
    removed++
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      console.error(`Baza je zauzeta: ${path}
Zatvori aplikaciju pa pokreni ponovo.`)
      process.exit(1)
    }
    throw err
  }
}

console.log(removed === 0 ? `nema baze na ${file}` : `obrisano (${removed} fajla): ${file}`)
