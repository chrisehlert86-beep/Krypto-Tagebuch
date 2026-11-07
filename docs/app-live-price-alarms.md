# Lokale Preisalarme in der App

Nutzerkorrektur vom 07.11.2026: Die App speichert die Alarmmarken selbst,
vergleicht sie selbst mit Live-Kursen und löst selbst den Alarm aus.
Die zuvor entworfenen Server-Alarme, Alarm-APIs, Installationsschlüssel,
Push-Ziele und Supabase-Migration wurden aus dieser Änderung entfernt.
Es werden keine persönlichen Alarmmarken hochgeladen. Eine Supabase-
Verbindung ist für diese Funktion nicht erforderlich.

## Android 3.3.0

Unter **Alarme → Eigenen Preisalarm anlegen**: Coin, über/unter und USDT-Kurs
eingeben und lokal speichern. Der Coin-Detailbildschirm verlinkt das Formular
und übernimmt den gewählten Coin. Dezimalkomma und Punkt sind erlaubt;
mehrdeutige Tausendertrennzeichen werden abgelehnt.

Die Marke liegt ausschließlich in privaten Android-SharedPreferences
`local_price_alarms_v1`. Android-Backup ist in der App deaktiviert. Auch das
Deaktivieren, der Status ausgelöst und die Alarmhistorie bleiben lokal.
Maximal 20 aktive Marken; begrenzte Historie, ohne aktive oder noch nicht
gemeldete Alarme beim Aufräumen zu verlieren.

Der lokale `LocalAlarmService` empfängt native Binance-Spot-Trades für
BTCUSDT, ETHUSDT und SOLUSDT. Er benutzt denselben öffentlichen Stream wie
Hermes, über eine eigene direkte Verbindung:

`wss://data-stream.binance.vision/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade`

Jeder frische Trade wird unmittelbar mit den lokal aktiven Marken verglichen.
Bei Gleichheit oder passendem über/unter wird der Alarm dauerhaft auf
ausgelöst gesetzt und eine lokale Android-Benachrichtigung erzeugt.
Der Trade muss nach dem Speichern der Marke liegen. Bereits erfüllte Marken
können beim nächsten Live-Trade sofort auslösen. Eine Kursrückkehr oder ein
Neustart aktiviert einen ausgelösten Alarm nicht erneut.

Die Marktübersicht, Coin-Details und das Alarmformular zeigen denselben
lokal empfangenen Kurs mit Kurszeit. Die Oberfläche aktualisiert ihre Anzeige
zweimal pro Sekunde; der Vergleich erfolgt direkt am Trade, unabhängig davon.
Alte, ungültige, zukünftige oder doppelte Trade-Pakete lösen keinen Alarm aus.
Nach 15 Sekunden ohne frischen Kurs wird dieser als letzter Kursstand gezeigt.

## Hintergrund und Geräte-Neustart

Solange aktive oder noch zu meldende Alarme vorhanden sind, bleibt ein
sichtbarer Android-Foreground-Service mit der Benachrichtigung **Lokale
Preisalarme** aktiv, auch nachdem das App-Fenster geschlossen wurde.
Der Dienst verbindet nach Netzabbrüchen erneut und zeigt den Verbindungsstatus.
Bei Geräte-Neustart oder App-Update setzt ein Boot-Receiver die Überwachung
vorhandener lokaler Alarme wieder fort. Sobald keine Überwachung mehr nötig
und das App-Fenster geschlossen ist, wird der Dienst beendet.

Eine ausgeschaltete oder offline befindliche App kann keine Live-Kurse
vergleichen. Erzwungenes Beenden oder Android-/Hersteller-Beschränkungen können
die Überwachung unterbrechen; die nächste App-Öffnung startet sie erneut.
Während einer Unterbrechung vergangene Kurskontakte werden nicht als live
ausgegeben. Die App macht keine Garantie für Hintergrundausführung unter
allen Energiespareinstellungen.

Benachrichtigungsberechtigung, die vorhandene Ruhezeit und Systemeinstellungen
gelten weiterhin. Historische eingehende Cloud-Marktmeldungen sind nur noch
stille Informationen; einen hörbaren Preisalarm erzeugt der lokale Vergleich.
Die frühere Preisalarm-Topic-Anmeldung wird bei App-Start abgemeldet. Für
persönliche Alarme gibt es keine Firebase-Zielregistrierung mehr.

## Web-Dashboard

Die Webansicht empfängt den gleichen Live-Stream direkt im Browser. Marken
liegen im lokalen Browserspeicher `local-price-alarms-v1` und werden dort
verglichen. Ein Browserwechsel oder Löschen der lokalen Website-Daten
übernimmt bzw. erhält diese Marken nicht. Im Browser muss die Seite geöffnet
bleiben; es wird keine Hintergrundausführung bei geschlossenem Browser
behauptet. Web Locks verhindern parallele Auslösungen mehrerer moderner
Tabs. Browser-Benachrichtigungen und ein kurzer Ton sind bei entsprechender
Freigabe möglich; ausgelöste Alarme bleiben in der Liste sichtbar.

Die Content Security Policy erlaubt zusätzlich ausschließlich den benötigten
Binance-WebSocket-Host. Alarmmarken werden weder an Binance noch an Hermes
oder Supabase übertragen. Binance erhält nur das öffentliche Stream-Abonnement.

## Validierung und Bereitstellung

Node- und Android-Unit-Tests prüfen lokalen über/unter-Vergleich einschließlich
Gleichheit, einmalige Auslösung, Speicherung/Wiederherstellung, Kursrückkehr,
deaktivierte Alarme, falsche Coins und alte/falsche Zeitstempel.
Die Android-Geräteprüfung kontrolliert zusätzlich private Speicherung,
weiterlaufenden Service nach Activity-Ende, lokale Auslösung und eine echte
lokale Android-Benachrichtigung. Der Test verwendet ausschließlich einen
synthetischen Kurs im Emulator und verschickt keine externe Testnachricht.

PR: [#30](https://github.com/chrisehlert86-beep/Krypto-Tagebuch/pull/30).
Es ist keine Änderung des laufenden Hermes-Servers für persönliche
App-Alarme notwendig. Seine stündliche Kerzen-/CPU-Auswertung und die
Pause täglicher und wöchentlicher KI-Analysen bleiben bestehen.

Verwendete Primärdokumentation:
[Binance-Trade-Streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md),
[Android-Foreground-Service-Typen](https://developer.android.com/develop/background-work/services/fgs/service-types#special-use)
und [OkHttp](https://github.com/square/okhttp).
