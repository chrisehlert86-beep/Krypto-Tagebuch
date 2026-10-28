# Markt-App und Telegram-Kurzmeldungen – Go-live

Stand: 2026-10-28

## Lieferumfang

- Geschütztes Markt-Dashboard unter `/admin/markets`
- BTC, ETH und SOL; die Datenstruktur bleibt für weitere Symbole offen
- 1D-, 1W- und 1M-Candlestick-Charts
- Elliott-Wellenpunkte, Fibonacci-Level, Zielzone und Invalidierung im Chart
- Kompakte Telegram-Ausgabe ohne Bilder und Langtext
- Explizites `WARTEN`, wenn kein Long-/Short-Szenario bestätigt ist
- Zielzonen-Prüfung im Minutentakt mit einmaligem Telegram-Alarm pro Zielzone
- Supabase als schmale, serverseitig geschützte Schnittstelle zwischen Geekom und App

## Vorbereiteter Geekom-Stand

Das inaktive Paket liegt unter:

`/opt/hermes-analysis/data/runtime_v091/asset-dashboard-20261028`

Es enthält die neuen Python-Module, die angepasste Pipeline, Tests sowie systemd-Service- und Timer-Vorlagen. Es ist nicht im Live-Pythonpfad und kein neuer Timer ist aktiviert.

## Kontrollierter Go-live

1. Vorhandene Live-Dateien auf dem Geekom in einem datierten, nicht öffentlich lesbaren Verzeichnis sichern.
2. Migration `supabase/migrations/20261028_market_analysis_dashboard.sql` in Supabase anwenden.
3. `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` sicher in `/opt/hermes-analysis/.env` ergänzen; Werte weder protokollieren noch in Git übernehmen.
4. `market_publication.py` und `market_alerts.py` nach `/opt/hermes-analysis/src/macro_waves/` übernehmen und die vorbereitete `pipeline.py` aktivieren.
5. Staging-Tests erneut gegen die Live-Pythonumgebung ausführen.
6. Einen Analysebericht ohne Telegram-Veröffentlichung erzeugen und die drei Supabase-Zeilen prüfen.
7. Webänderungen committen und über den bestehenden GitHub-/Vercel-Weg deployen.
8. `/admin/markets` mit Adminsession prüfen: BTC/ETH/SOL, alle drei Zeitebenen und mobile Breite.
9. Je eine kompakte Telegram-Testnachricht in einen Testchat senden.
10. `hermes-market-alerts.service` und `.timer` in den User-systemd-Pfad übernehmen, `daemon-reload` ausführen und den Timer aktivieren.
11. Erst danach die neue Telegram-Veröffentlichung für den nächsten regulären Analyselauf freigeben.

## Abnahme

- Web-API liefert nur die bereinigten Markt-DTOs, niemals Service-Key oder untrusted Quellen.
- Unbestätigte Marktlage erzeugt `Richtung: WARTEN`.
- LONG/SHORT wird ausschließlich aus dem Supervisor-Bias übernommen.
- Zielalarm wird beim ersten Erreichen ausgelöst und für dieselbe Zielzone nicht wiederholt.
- Telegram veröffentlicht keine Chartbilder und keinen langen Analysetext mehr.
- App und API bleiben durch die bestehende Adminsession geschützt.

## Rückweg

- Alert-Timer deaktivieren und stoppen.
- Gesicherte `pipeline.py` zurückspielen; neue Zusatzmodule können liegen bleiben, solange sie nicht importiert werden.
- Vorherige Webversion über Vercel wiederherstellen.
- Die neue Supabase-Tabelle kann für einen Rückweg bestehen bleiben, da ältere Versionen sie nicht verwenden.
