import { app, shell, BrowserWindow, ipcMain, nativeTheme, Menu, screen } from 'electron'
import { join } from 'node:path'
import type { EntryPatch, RunningTimer, TimeEntry } from '../shared/types'
import * as db from './db'

const isMac = process.platform === 'darwin'
const isDev = !app.isPackaged

const DEFAULT_BOUNDS = { width: 1280, height: 900 }

/** Zapamcena pozicija prozora; odbacujemo je ako je ekran u medjuvremenu nestao. */
function savedBounds(): { width: number; height: number; x?: number; y?: number } {
  try {
    const raw = db.getSettings()['windowBounds']
    if (raw === undefined) return DEFAULT_BOUNDS
    const b = JSON.parse(raw) as { width: number; height: number; x: number; y: number }
    if (typeof b.width !== 'number' || typeof b.height !== 'number') return DEFAULT_BOUNDS
    const fits = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y
    })
    return fits ? b : { width: b.width, height: b.height }
  } catch {
    return DEFAULT_BOUNDS
  }
}

function createWindow(): BrowserWindow {
  const bounds = savedBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#F5F5F2',
    // Na macOS-u skrivamo naslovnu traku i koristimo sidebar kao drag region.
    // Windows/Linux ostaju na standardnom okviru — custom okvir tamo donosi
    // vise problema (snap, maximize) nego koristi.
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 20 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // Pozicija se upisuje tek kad se korisnik smiri, ne na svaki piksel.
  let saveTimer: NodeJS.Timeout | null = null
  const rememberBounds = (): void => {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
      db.setSetting('windowBounds', JSON.stringify(win.getNormalBounds()))
    }, 500)
  }
  win.on('resize', rememberBounds)
  win.on('move', rememberBounds)
  win.on('close', () => {
    if (saveTimer !== null) clearTimeout(saveTimer)
    if (!win.isMinimized() && !win.isFullScreen()) {
      db.setSetting('windowBounds', JSON.stringify(win.getNormalBounds()))
    }
  })

  // Eksterni linkovi idu u sistemski browser, ne u prozor aplikacije.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light' // dizajn je za sad samo svetla tema

  // Dizajn nema meni traku. Na macOS-u meni ostaje jer nosi Cmd+Q i Cmd+C/V.
  if (!isMac) Menu.setApplicationMenu(null)

  db.open()

  ipcMain.handle('projects:list', () => db.listProjects())
  ipcMain.handle('projects:totals', () => db.listProjectsWithTotals())
  ipcMain.handle('projects:create', (_e, name: string, color: string) => db.createProject(name, color))
  ipcMain.handle('projects:update', (_e, id: string, patch: { name?: string; color?: string }) =>
    db.updateProject(id, patch)
  )
  ipcMain.handle('projects:delete', (_e, id: string) => db.deleteProject(id))

  ipcMain.handle('settings:get', () => db.getSettings())
  ipcMain.handle('settings:set', (_e, key: string, value: string) => db.setSetting(key, value))
  ipcMain.handle('entries:list', (_e, from: string, to: string) => db.listEntries(from, to))
  ipcMain.handle('entries:minutes', (_e, from: string, to: string) => db.minutesIn(from, to))
  ipcMain.handle('entries:create', (_e, entry: Omit<TimeEntry, 'id'>) => db.createEntry(entry))
  ipcMain.handle('entries:update', (_e, id: string, patch: EntryPatch) => db.updateEntry(id, patch))
  ipcMain.handle('entries:delete', (_e, id: string) => db.deleteEntry(id))

  ipcMain.handle('running:get', () => db.getRunning())
  ipcMain.handle('running:start', (_e, desc: string, projectId: string | null, billable: boolean) =>
    db.startRunning(desc, projectId, billable)
  )
  ipcMain.handle('running:stop', () => db.stopRunning())
  ipcMain.handle('running:update', (_e, patch: Partial<Omit<RunningTimer, 'startedAt'>>) =>
    db.updateRunning(patch)
  )

  ipcMain.handle('db:path', () => db.dbPath())
  ipcMain.handle('db:reveal', () => shell.showItemInFolder(db.dbPath()))
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('app:version', () => app.getVersion())

  createWindow()

  // macOS: klik na ikonu u Dock-u kad nema prozora otvara novi.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS aplikacija ostaje ziva kad se zatvori prozor; Windows/Linux izlaze.
app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

app.on('will-quit', () => db.close())
