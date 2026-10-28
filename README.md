# Krypto-Tagebuch

Private Community-Plattform mit einem geschützten Adminbereich und einem
mehrstufigen Mitglieder-Onboarding über Einladungscode und Telegram.

## Entwicklung

```bash
npm install
npm run dev
```

Qualitätsprüfungen:

```bash
npm test
npm run lint
npm run build
```

Der produktive Sicherheitstest wird bewusst separat ausgeführt:

```bash
npm run security:smoke
```

## Umgebungsvariablen

Lokale Zugangsdaten gehören ausschließlich in `.env.local` und niemals in Git.
Eine bereinigte Importdatei für Vercel wird außerhalb des Repositories erzeugt:

```bash
npm run env:vercel
```

Standardausgabe unter Windows: `D:\vercel-import.env`.

## Architektur

- Next.js 16 und React 19
- Supabase als Datenbank
- separater Telegram-Bot auf dem Geekom
- Vercel für das Web-Deployment
- geschütztes Markt-Dashboard mit von Geekom synchronisierten Analyse-Daten

Die Webseite kommuniziert mit Telegram ausschließlich über signierte
Telegram-Login-Daten und Supabase. Der Bot läuft unabhängig als systemd-Dienst.

Der vorbereitete Ablauf für Markt-App, Kurzmeldungen und Zielzonen-Alarme ist in
[`docs/market-system-go-live.md`](docs/market-system-go-live.md) dokumentiert.

## Android-App

Die Android-App liegt unter [`android-app`](android-app) und öffnet die geschützte,
für Smartphones optimierte Route `/mobile/markets`. Zugangsdaten werden nicht im
App-Code gespeichert; die Anmeldung verwendet die serverseitig geprüfte
Admin-Sitzung der Web-App.

Ein installierbares APK wird bei Android-Tags (`android-v*`) über
`.github/workflows/android-apk.yml` gebaut und als GitHub Release veröffentlicht.
