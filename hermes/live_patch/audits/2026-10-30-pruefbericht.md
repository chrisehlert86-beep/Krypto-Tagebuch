# Hermes: Fehlerkorrektur und Agentenprüfung vom 30.10.2026

Der fehlerhafte Signalpfad wurde auf dem Geekom korrigiert und aktiviert. Die
App-Datensätze für BTC, ETH und SOL wurden bereinigt. Die bisher veröffentlichten
Ziele gelten damit nicht als bestätigte Signale; aktuell wird WARTEN ausgegeben.

## Nachgewiesene Ursachen

1. Die Telegram-Ziele aus dem Screenshot kamen aus einer manuellen Override-Datei.
   Diese Ausgabe prüfte weder Anker noch Formeln noch den weiteren Szenarioverlauf.
2. Die Modellvorgaben schrieben eine laufende Monats-B vor. Der bisherige Validator
   ersetzte bärische Labels pauschal durch einen unbestätigten Rücksetzer.
3. Der Validator konnte Anker auf andere Kerzen verschieben, Preise anpassen,
   Invalidierungen ersetzen und eine von mehreren Fibonacci-Rechenrichtungen
   passend zum Modellpreis auswählen. So entstand keine unabhängige Regelprüfung.
4. Die Chartdarstellung verwendete Tagesziele und Tages-Wellenpunkte auch dann,
   wenn für eine andere Zeitebene kein eigener Signalplan existierte.

## Aktivierte Korrektur

- Keine Übernahme manueller Signalüberschreibungen; alte Datei mit Sicherung stillgelegt.
- Kein vorgeschriebener Monatscount und keine automatische Umbenennung bärischer Counts.
- Exakte OHLC-Anker ausschließlich aus der ausgewiesenen Zeitebene; keine stillen Reparaturen.
- Fibonacci-Methode, zwei beziehungsweise drei Anker und exakte CPU-Rechnung mit Formel.
- Klassische Impulsregeln mit Wellenursprung, Reihenfolge und zwischenliegenden Wicks.
- Keine Einstiegsbestätigung allein durch das Berühren einer Fibonacci-Zone.
- Invalidierung, Zielkontakt und Ablauf werden getrennt geprüft. Ein beendetes Szenario
  wird durch eine Kurserholung nicht wieder aktiv. Bei unklarer Reihenfolge innerhalb
  derselben Kerze wird kein Treffer behauptet.
- Eigene Evidenz je Zeitebene. Ohne belegte 30M-Analyse erscheint kein 30M-LONG.
- Rollenfreigabe für genau die getestete Kombination aus Rolle und Modell.

## Tatsächliche Agentenprüfung

Jede der 20 konfigurierten Rollen erhielt 15 feste synthetische Prüfaussagen.
Geprüft wurden Impulsregeln in beiden Richtungen, Welle 3, Welle 4, Wellenursprung,
Diagonalen, Flat/Zigzag, Fibonacci-Rechnung, Projektionen, Zeitebenen und Invalidierung.
Die Antworten wurden gegen feste Sollwerte geprüft, nicht durch einen weiteren KI-Juror.

| Rolle | Modell | Ergebnis | Freigabe |
|---|---|---|---|
| bull_current_wave | Gemini 3 Flash Preview | 15/15 | ja |
| bull_fibonacci | GPT 5.6 Luna | 15/15 | ja |
| bull_confirmation | Claude Haiku 4.5 | 11/15 | gesperrt |
| bull_macro | Gemini 3 Flash Preview | 15/15 | ja |
| bear_current_wave | Claude Haiku 4.5 | 11/15 | gesperrt |
| bear_fibonacci | GPT 5.6 Luna | 15/15 | ja |
| bear_confirmation | Gemini 3 Flash Preview | 14/15 | gesperrt |
| bear_macro | Claude Haiku 4.5 | 11/15 | gesperrt |
| elliott_hierarchy | GPT 5.6 Luna | 15/15 | ja |
| anchors_and_fibonacci | GPT 5.6 Luna | 15/15 | ja |
| directional_integrity | GPT 5.6 Luna | 15/15 | ja |
| macro_and_method_audit | GPT 5.6 Luna | 15/15 | ja |
| bull_leader | Gemini 3.1 Pro Preview | 15/15 | ja |
| bear_leader | Claude Sonnet 4.6 | ungültiges Antwortformat | gesperrt |
| rules_leader | GPT 5.6 Luna Pro | 14/15 | gesperrt |
| supervisor | GPT 5.6 Sol | 15/15 | ja |
| critic_gemini_quick | Gemini 3 Flash Preview | 15/15 | ja |
| critic_gemini_deep | Gemini 3.1 Pro Preview | 15/15 | ja |
| critic_claude_quick | Claude Haiku 4.5 | ungültiges Antwortformat | gesperrt |
| critic_claude_deep | Claude Sonnet 4.6 | 13/15 | gesperrt |

Ergebnis: **12 bestanden, 6 mit fachlichen Fehlantworten, 2 ohne auswertbares
Antwortformat.** Alle acht nicht bestandenen beziehungsweise nicht nachgewiesenen
Rollen sind gesperrt. Es wird kein ungeprüftes Ersatzmodell eingeschleust.

Konkrete Fehler: Haiku bezeichnete eine Welle 4 oberhalb des Welle-1-Endes als
Überlappung und erlaubte an anderer Stelle einen verbotenen Wick. Mehrere Rollen
bewerteten die Aussage zur kürzesten Welle 3 falsch. Teilweise widersprachen
Entscheidung und Begründung einander: Die Fibonacci-Rechnung wurde richtig
vorgerechnet, ihre richtige Aussage aber als falsch markiert. Das ist auch für
eine spätere Supervisor-Entscheidung ein relevanter Zuverlässigkeitsfehler.

Zwei Fehler des Prüfaufbaus wurden korrigiert: Die GPT-Rollen wurden zunächst
mit einem von ihrem Routing nicht unterstützten Schema-Antwortmodus angesprochen;
der Supervisor-Test enthielt zunächst nicht das vom produktiven Adapter verlangte
Konfidenzfeld. Nur diese technisch ungültigen Tests wurden wiederholt. Die
fachlich falschen Antworten wurden nicht durch Wiederholung in bestandene
Ergebnisse verwandelt. Die ursprünglichen Prüfdateien bleiben auf dem Server erhalten.

## Verifikation und Grenzen

- 36 Regressionstests lokal und in der Live-Pythonumgebung bestanden.
- TypeScript, ESLint und Next.js-Produktionsbuild bestanden.
- Sieben vorhandene Web-Sicherheitstests bestanden.
- Tatsächlich importierte Module und alle vier Analyse-/Ausgabedienste geprüft.
- Drei korrigierte Supabase-Datensätze zurückgelesen; keine alten Signal-Level mehr.
- Inbox und Alarmtimer aktiv; erster korrigierter Alarmdienst-Lauf mit Exit 0 beendet.
- Bei der Aktivierung wurden keine Telegram-Nachrichten gesendet.

Das ist eine begrenzte Kompetenzprüfung, kein Nachweis dauerhafter analytischer
Zuverlässigkeit. Ein einfacher Endpunktcheck beweist keine vollständige interne
Unterteilung und keinen eindeutigen Elliott-Count. Nicht ausreichend belegte
Korrekturen und Diagonalen bleiben bedingt und liefern kein Richtungssignal.
Der Betrieb ist durch die gesperrten Rollen eingeschränkt; es wurde noch kein
neuer vollständiger Marktbericht mit allen Rollen freigegeben.

Die Änderungen ersetzen nicht den gesamten geplanten Hermes-Umbau. Die isolierte
Phase-1-Engine wurde nicht an die Produktion angeschlossen.

## Belege

- [Prüfantworten und Bewertungen](2026-10-30-agent-audit.json)
- [Aktivierungsnachweis und Sicherungspfad](2026-10-30-activation.json)
- [Elliott Wave International: Impulse](https://www.elliottwave.com/waveopedia/impulse/)
- [Elliott Wave International: Diagonals](https://www.elliottwave.com/waveopedia/elliott-wave-pattern-diagonals/)
- [Elliott Wave International: Zigzags](https://www.elliottwave.com/waveopedia/zigzags/)
- [Elliott Wave International: Flats](https://www.elliottwave.com/waveopedia/flats/)
