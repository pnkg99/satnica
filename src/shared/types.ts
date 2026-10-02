/** Jedan projekat. */
export interface Project {
  id: string
  name: string
  color: string
}

/** Zavrsen unos vremena. Vreme je ISO string u lokalnoj zoni sa offsetom. */
export interface TimeEntry {
  id: string
  desc: string
  projectId: string | null
  start: string
  end: string
  billable: boolean
  tags: string[]
}

/** Timer koji trenutno radi; null kad nista ne radi. */
export interface RunningTimer {
  desc: string
  projectId: string | null
  billable: boolean
  startedAt: string
}

/** Polja koja UI sme da menja na postojecem unosu. */
export interface EntryPatch {
  desc?: string
  projectId?: string | null
  billable?: boolean
  start?: string
  end?: string
}

/** Projekat sa zbirovima — za ekran Projekti. */
export interface ProjectWithTotals extends Project {
  minutes: number
  billableMinutes: number
  entryCount: number
}
