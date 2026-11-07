# Live-Kurse und persönliche Preisalarme

Stand: 07.11.2026. Implementiert in [PR #30](https://github.com/chrisehlert86-beep/Krypto-Tagebuch/pull/30).
Die neue Anbindung ist noch **nicht produktiv aktiviert**, weil der vorhandene
Supabase-Servicezugang keine DDL-Migration ausführen kann und die beiden neuen
Tabellen noch fehlen. Die laufenden Live-Alarme, stündliche CPU und KI-Pause
bleiben erhalten. Auf Hermes liegt das neue Release getestet und inaktiv bereit.

## Verhalten

- Android 3.3.0 zeigt auf Marktübersicht, Coin-Detail und im Alarmformular die
  Kurse desselben nativen Binance-Trade-Streams wie der Alarmdienst.
- Der Server synchronisiert den letzten Trade je Coin ungefähr jede Sekunde
  nach Supabase; die sichtbare App fragt alle zwei Sekunden nach. Die Anzeige
  ist damit eine laufend aktualisierte Ansicht desselben Streams, keine
  garantierte Darstellung jedes einzelnen Trades. Alarme werden weiterhin
  direkt an den Trade-Ereignissen auf Hermes geprüft.
- Kurszeit und Empfangszeit werden mitgegeben. Nach 15 Sekunden ohne frischen
  Trade oder bei einem Verbindungsfehler zeigt die Oberfläche den letzten
  Kursstand statt einer falschen Live-Markierung.
- Unter **Alarme → Eigenen Preisalarm anlegen**: Coin wählen, über/unter wählen,
  USDT-Kurs eingeben und speichern. Der Coin-Detailbildschirm verlinkt das
  Formular und übernimmt den gewählten Coin. Dezimalkomma und Punkt erlaubt;
  mehrdeutige Tausendertrennzeichen werden abgelehnt.
- Die Bedingung gilt einschließlich der eingegebenen Kursmarke. Ist sie schon
  erfüllt, kann der nächste Trade nach Übernahme der Konfiguration sofort
  auslösen. Die Konfiguration wird ungefähr sekündlich übernommen.
- Der Alarm ist einmalig und unabhängig von KI-Szenarien. Die aktive Liste
  erlaubt Deaktivieren und zeigt ausgelöste Alarme. Neue Eingaben können
  dieselbe Marke später erneut überwachen. Bis zu 20 aktive Alarme pro Gerät.
- Android-Push geht gezielt an das Gerät, das den Alarm gespeichert hat,
  auch bei geschlossener App. Bestehende Ruhezeiten und Systemberechtigungen
  gelten weiter. Der Web-Dashboard-Browser zeigt seine eigenen ausgelösten
  Alarme im geöffneten Dashboard; Browser-Hintergrundpush ist nicht enthalten.

## Daten und Zustellung

`market_live_prices`: drei aktuelle Kursdatensätze mit originalem Trade-Zeitpunkt
und Trade-ID. `market_price_alerts`: persönliche Schwellen und deren Status.
Beide Tabellen sind durch RLS gegen direkte Anon-/Authenticated-Zugriffe
gesperrt. Der Service-Key bleibt serverseitig. In der App wird ein zufälliges
256-Bit-Installationsgeheimnis gespeichert; der Server nutzt nur dessen Hash
als Eigentümerkennung. Lese-/Änderungsabfragen sind immer darauf beschränkt.
Push-Ziele und Eigentümerkennungen werden nie an Clients zurückgegeben.

Alarmkontakte werden lokal vor der Zustellung dauerhaft gesichert. Die
serverseitige Zustandsänderung `active → triggered` wird atomar beansprucht.
Erfolgreiche Push-Zustellung erhält einen separaten Checkpoint; ein späterer
Speicherfehler löst keinen zweiten Push aus. Android ignoriert bereits bekannte
Ereignis-IDs. Eine nach Annahme der Nachricht verlorene Netzwerkantwort kann
trotzdem eine erneute Zustellung verursachen; eine genau-einmal-Garantie wird
nicht behauptet. Fehler eines persönlichen Push-Ziels halten andere Ziele
nicht auf. Netzwerk und Push laufen getrennt vom Streamverbraucher.

Auch bestehende freigegebene Szenarioalarme erhalten wieder einen App-Push;
Telegram und App haben dabei getrennte Wiederholungs-Checkpoints.

## Validierung

- 11 Node-Tests einschließlich Zahlenformat, Coin-/Richtungsprüfung,
  Installationsauthentifizierung und Kursfrische bestanden.
- TypeScript, gezielter ESLint-Lauf und Next.js-Produktionsbuild bestanden.
- 30 Server-Regressionstests bestanden: native Kursweitergabe, eigene Schwellen
  ohne KI-Plan, über/unter, Deaktivieren, kurzer Kontakt, Neustart, Wiederholung
  bei Fehlern und keine Doppelzustellung nach erfolgreichem Push-Checkpoint;
  außerdem die bisherigen Live-/Kerzenprüfungen.
- Firebase-Servicekonto mit `validate_only=true` geprüft. **Keine echten
  Testnachrichten versandt.**
- Android-APK-Build, Unit-Tests, Lint und Emulatorprüfung werden im PR ausgeführt.
  Der Emulator erstellt `personal-price-alarm.png` für die visuelle Kontrolle.
- Der echte durchgehende Test von Eingabe bis Produktionsalarm steht bis zur
  Supabase-Migration und Aktivierung noch aus.

## Aktivierung

1. Die additive Migration
   `supabase/migrations/20261107_live_prices_and_personal_alerts.sql` auf dem
   bestehenden Supabase-Projekt anwenden. Dafür ist ein SQL-/Administrationszugang
   erforderlich. Der vorhandene REST-Service-Key stellt diese Fähigkeit nicht
   bereit; die OpenAPI-Prüfung zeigte keine SQL-Verwaltungs-RPC.
2. Auf Hermes aktivieren und prüfen:

   ```sh
   /opt/hermes-analysis/.venv/bin/python /opt/hermes-analysis/data/runtime_v091/app-live-alarms-20261107/install.py activate
   /opt/hermes-analysis/.venv/bin/python /opt/hermes-analysis/data/runtime_v091/app-live-alarms-20261107/install.py verify
   ```

3. Bei grünen Android-Prüfungen den PR nach `main` übernehmen und das bestehende
   Vercel-Deployment prüfen. Danach Android 3.3.0 über den bestehenden
   Release-Workflow veröffentlichen.
4. Live-Kurse mit Hermes-Trade-Zeiten vergleichen; persönlichen, nicht
   erfüllten Alarm erstellen, nur mit derselben Installation lesen und
   deaktivieren. Android-Update installieren und echten Alarm nach bewusster
   Auswahl einer Marke prüfen. Kein Fremdgerät und kein Sammel-Topic für
   persönliche Testalarme verwenden.

Hermes-Dateien: `hermes/live_fixes/app-live-alarms-20261107/`.
Health: `/opt/hermes-analysis/reports/live-alerts/app-health.json`.
Die Stundenplanung und die KI-Pause werden durch diese Aktivierung nicht geändert.

Rückweg des neuen Hermes-Pfads:

```sh
/opt/hermes-analysis/.venv/bin/python /opt/hermes-analysis/data/runtime_v091/app-live-alarms-20261107/install.py rollback
```

Die neuen Tabellen und gespeicherten Alarme bleiben dabei erhalten. Historische
Analyseberichte werden durch Kursweitergabe oder persönliche Alarme nicht als
neu erzeugte KI-Auswertung ausgegeben.
