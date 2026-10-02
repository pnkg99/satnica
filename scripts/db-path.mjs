import { homedir } from 'node:os'
import { join } from 'node:path'

/** productName iz electron-builder.yml — isti folder koji Electron pravi. */
const APP = 'Satnica'

/**
 * Isto sto vrati app.getPath('userData'), ali bez pokretanja Electrona,
 * da seed skripta moze da radi pod obicnim Nodeom.
 */
export function userDataDir() {
  switch (process.platform) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', APP)
    case 'win32':
      return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), APP)
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), APP)
  }
}

export function dbFile() {
  return join(userDataDir(), 'satnica.db')
}
