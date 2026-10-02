# Satnica — praćenje vremena

Desktop prototip po dizajnu iz canvasa. Electron + React + TypeScript (electron-vite),
podaci u SQLite bazi. Radi na Windows, Linux i macOS.

## Instalacija na macOS

U Terminal nalepi:

```
curl -fsSL https://raw.githubusercontent.com/pnkg99/satnica/main/scripts/install-mac.sh | bash
```

Skida poslednji `.dmg` sa Releases (Apple Silicon ili Intel), stavlja Satnicu u
`/Applications` i skida karantin (aplikacija nije potpisana). Ista komanda radi i
za ažuriranje.

Novi build: `git tag v1.0.1 && git push --tags` — GitHub Actions pravi dmg na
macOS runneru i kači ga na Release.

## Pokretanje

```
npm install
npm run dev        # dev sa hot reloadom
npm start          # build + pokretanje bez HMR-a
npm run typecheck
```

Ako `npm install` ne povuče Electron binarni fajl (greška `Electron uninstall`):

```
node node_modules/electron/install.js
```

## Baza

SQLite preko **`node:sqlite`** — modula ugrađenog u Node 24, koji dolazi sa
Electronom 44. Nema native zavisnosti, nema `better-sqlite3`, nema
`@electron/rebuild`: isti kod se pakuje na sva tri OS-a bez dodatnog koraka.

Fajl je `satnica.db` u OS-ovom app-data folderu:

| OS      | putanja                                 |
| ------- | --------------------------------------- |
| macOS   | `~/Library/Application Support/Satnica/` |
| Windows | `%APPDATA%\Satnica\`                    |
| Linux   | `~/.config/Satnica/`                    |

Podešavanja → **Otvori folder sa bazom** otvara ga direktno.

### Prva instalacija je prazna

Nova baza dobija samo 4 podrazumevana projekta (ACME, Projekat X, Kancelarija,
Pauza) — nijedan unos. Ekran pokazuje prazno stanje dok ne pokreneš prvi timer.

### Test podaci

```
npm run seed              # dodaje 14 test unosa u postojecu bazu
npm run seed -- --reset   # prvo obrise sve unose, pa ubaci
npm run db:reset          # brise ceo .db fajl — sledeci start je pravi prvi start
```

Seed radi pod običnim Nodeom, aplikacija ne mora da bude pokrenuta —
**ali je zatvori pre nego što pustiš seed**, inače piše preko njega.
Datumi u seedu su relativni na danas (danas, juče, pre 2–3 dana, prošla nedelja),
pa test podaci uvek padaju u vidljive nedelje.

### Šema

Definisana je na jednom mestu, `src/shared/schema.ts`, i dele je aplikacija i
seed skripta. Verzija ide kroz `PRAGMA user_version`, bez migracionog frameworka —
`migrate()` u `src/main/db.ts` samo dopunjava ono što stariji fajl nema.

```
projects    (id, name, color, position)
entries     (id, description, project_id→projects, started_at, ended_at, billable)
entry_tags  (entry_id→entries, tag)
running     (id=1, description, project_id, billable, started_at)   -- najvise 1 red
settings    (key, value)                                            -- v2
```

`settings` drzi `weeklyGoalMinutes`, `dayStartHour`, `dayEndHour` i
`windowBounds` (velicina i pozicija prozora izmedju pokretanja).

Vreme se čuva kao ISO string (`2026-10-01T10:44:33.548Z`). `running` je tabela,
a ne memorija, pa timer preživi zatvaranje aplikacije.

## Pakovanje

```
npm run pack:dir     # raspakovana aplikacija u dist/, bez instalera
npm run build:win    # NSIS instaler
npm run build:linux  # AppImage + deb
npm run build:mac    # dmg (arm64 + x64) — MORA da se pokrene na Mac-u
```

electron-builder ne ume da napravi `.dmg` sa Windowsa. Za macOS paket postoje dve opcije:

1. Prijatelj sa Mac-om klonira repo i pokrene `npm install && npm run build:mac`.
2. GitHub Actions sa `macos-latest` runnerom (nije još podešeno).

Build nije potpisan (`identity: null`). Na tuđem Mac-u se prvi put otvara
desnim klikom → **Open** → **Open**, inače Gatekeeper blokira.

Ikona se generiše iz koda:

```
node scripts/make-icon.mjs   # pravi build/icon.png, 1024x1024
```

electron-builder iz tog PNG-a sam izvede `.icns` i `.ico`.

## Struktura

```
src/
  main/      Electron glavni proces — prozor, IPC, SQLite (db.ts)
  preload/   contextBridge most (window.api)
  shared/    tipovi i sema baze, dele ih main i skripte
  renderer/  React UI
scripts/     seed, reset baze, generator ikone
build/       icon.png za electron-builder
```

## Ekrani

**Praćenje vremena** — timer (opis, projekat, naplativo, start/stop), nedeljni
grafik, lista unosa po danima sa izmenom opisa, naplativosti i brisanjem.

**Kalendar** — nedeljni grid, blokovi u boji projekta. Povlačenje po praznom pravi
unos, blok se pomera prevlačenjem (i u drugi dan), donja ivica ga rasteže. Snap na
15 minuta. Crvena linija pokazuje trenutno vreme. Vidljivi opseg sati se bira u
Podešavanjima.

**Izveštaji** — period se bira (ova nedelja / prošla / ovaj mesec / poslednjih 30
dana): ukupno, naplativo, nenaplativo, broj dana sa unosom, grafik po danima i
razrada po projektima sa procentima.

**Projekti** — dodavanje, preimenovanje, izbor boje iz palete, brisanje. Ukupno i
naplativo vreme po projektu. Brisanje projekta ne briše unose — njima `project_id`
ide na `NULL`.

**Podešavanja** — nedeljni cilj (traka u levoj koloni), vidljivi sati u kalendaru,
putanja do baze sa dugmetom za otvaranje foldera, verzija.

### Što još nije

- Tagovi se vide, ali se ne menjaju iz UI-ja — ubacuje ih samo seed.
- Klik na blok u kalendaru vodi na Praćenje; nema izmene na licu mesta.
- Nema auth-a ni sinhronizacije.
- Samo svetla tema.

## Napomene uz 1.0.0

- Unos se vezuje za dan u kom je **počeo**, kao u Clockify-ju. Unos preko ponoći
  se u kalendaru seče na donjoj ivici prikazanog opsega.
- Unosi koji su celi van prikazanog opsega sati se ne crtaju; kalendar ispiše
  koliko ih je i uputi na Podešavanja.
- Preklopljeni unosi dele širinu kolone. Od tri naviše ostaje samo naslov —
  pun opis i vreme su u tooltipu.
- Build nije potpisan. `maintainer` za `deb` je `DV Strategic <pn@dv-strategic.dev>`
  u `electron-builder.yml` — promeni ako treba drugo ime.
