import { contextBridge, ipcRenderer } from 'electron'
import type { EntryPatch, Project, ProjectWithTotals, RunningTimer, TimeEntry } from '../shared/types'

const api = {
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
  listProjectTotals: (): Promise<ProjectWithTotals[]> => ipcRenderer.invoke('projects:totals'),
  createProject: (name: string, color: string): Promise<Project> =>
    ipcRenderer.invoke('projects:create', name, color),
  updateProject: (id: string, patch: { name?: string; color?: string }): Promise<void> =>
    ipcRenderer.invoke('projects:update', id, patch),
  deleteProject: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id),

  getSettings: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  listEntries: (from: string, to: string): Promise<TimeEntry[]> =>
    ipcRenderer.invoke('entries:list', from, to),
  minutesIn: (from: string, to: string): Promise<number> =>
    ipcRenderer.invoke('entries:minutes', from, to),
  createEntry: (entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry> =>
    ipcRenderer.invoke('entries:create', entry),
  updateEntry: (id: string, patch: EntryPatch): Promise<void> =>
    ipcRenderer.invoke('entries:update', id, patch),
  deleteEntry: (id: string): Promise<void> => ipcRenderer.invoke('entries:delete', id),

  getRunning: (): Promise<RunningTimer | null> => ipcRenderer.invoke('running:get'),
  startRunning: (desc: string, projectId: string | null, billable: boolean): Promise<void> =>
    ipcRenderer.invoke('running:start', desc, projectId, billable),
  stopRunning: (): Promise<TimeEntry | null> => ipcRenderer.invoke('running:stop'),
  updateRunning: (patch: Partial<Omit<RunningTimer, 'startedAt'>>): Promise<void> =>
    ipcRenderer.invoke('running:update', patch),

  dbPath: (): Promise<string> => ipcRenderer.invoke('db:path'),
  revealDb: (): Promise<void> => ipcRenderer.invoke('db:reveal'),
  platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('app:platform'),
  version: (): Promise<string> => ipcRenderer.invoke('app:version')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
