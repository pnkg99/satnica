const DAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']
const MONTHS_LONG = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar'
]
const WEEKDAYS_LONG = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']

export { DAY_LABELS }

const pad = (n: number): string => String(n).padStart(2, '0')

/** Minuti -> "H:MM" (kao na dizajnu: 3:30, ne 03:30). */
export function fmtMinutes(min: number): string {
  return `${Math.floor(min / 60)}:${pad(min % 60)}`
}

/** Sekunde -> "HH:MM:SS" za štopericu. */
export function fmtClock(sec: number): string {
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`
}

/** ISO -> "HH:MM" u lokalnoj zoni. */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Ponedeljak kao prvi dan nedelje, lokalno, u 00:00. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Lokalni kljuc dana "YYYY-MM-DD" — ne koristiti toISOString, on je UTC. */
export function dayKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "28. sep – 4. okt" */
export function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const a = `${monday.getDate()}. ${MONTHS_SHORT[monday.getMonth()]}`
  const b = `${sunday.getDate()}. ${MONTHS_SHORT[sunday.getMonth()]}`
  return `${a} – ${b}`
}

/** "Četvrtak, 1. oktobar" */
export function fmtLongDate(date: Date): string {
  const wd = WEEKDAYS_LONG[(date.getDay() + 6) % 7]
  return `${wd}, ${date.getDate()}. ${MONTHS_LONG[date.getMonth()]}`
}

/** Naslov grupe: Danas / Juče / "Pon, 29. sep" */
export function fmtGroupTitle(date: Date): string {
  const today = dayKey(new Date())
  const key = dayKey(date)
  if (key === today) return 'Danas'
  if (key === dayKey(addDays(new Date(), -1))) return 'Juče'
  const wd = DAY_LABELS[(date.getDay() + 6) % 7]
  return `${wd}, ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`
}

/** Trajanje unosa u punim minutima, minimum 1. */
export function durationMinutes(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

/** Minut u danu (0..1439) za dati trenutak, lokalno. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Prvi dan meseca, lokalno, u 00:00. */
export function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

/** "1. oktobar 2026" */
export function fmtFullDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`
}

/** Srpska mnozina: 1 unos, 2-4 unosa, 5+ unosa (uz izuzetak 11-14). */
export function pluralEntries(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return `${n} unos`
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} unosa`
  return `${n} unosa`
}
