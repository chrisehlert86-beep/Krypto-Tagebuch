# Hermes: Nachweis fachlicher Analysefähigkeit

Stand: 30.10.2026. Dieses Dokument beschreibt die noch erforderliche Abnahme.
Es ist keine Behauptung, dass diese Fähigkeiten bereits implementiert oder
nachgewiesen sind. Es konkretisiert den vorhandenen Umbauplan in `umbau.md`.

## Ausgangspunkt

Der bisherige Test umfasste 15 synthetische Prüfaussagen pro konfigurierter Rolle.
12 Rollen bestanden diesen Wissenstest, 6 antworteten fachlich falsch, 2 lieferten
kein auswertbares Antwortformat. Dies ist kein Nachweis professioneller Analyse
realer Charts. Auch ein bestandenes Modell bleibt fehlbar.

Die aktivierte Korrektur entfernt manuelle Zielüberschreibungen und mehrere
stille Veränderungen von Counts. Bei der anschließenden Nachprüfung wurde eine
weitere Lücke gefunden: Ein Impuls konnte als `valid` bewertet werden, obwohl
die interne 5-3-5-3-5-Unterteilung lediglich als ungeprüfte Warnung geführt wurde.
Die verschärfte Freigabe trennt jetzt Endpunktprüfung und Strukturprüfung:
Endpunkte allein bleiben `conditional` und können kein Richtungssignal freigeben.
Ein vollständiger allgemeiner Elliott-Strukturprüfer ist noch nicht vorhanden.

## Ziel und Garantiegrenze

Nachweisbar sein müssen korrekte Datenverwendung, Rechenwege, durchgesetzte
formalisierte Regeln, transparente Hypothesen und rechtzeitige Invalidierung.
Eine immer richtige zukünftige Marktprognose oder eine stets eindeutige
Wellenzählung wird nicht zugesichert. Mehrdeutige Counts und unvollständige
Strukturen müssen als solche behandelt werden.

Die Begriffe sind künftig strikt zu unterscheiden:

| Zustand | Bedeutung | Darf einen bestätigten Count begründen? |
|---|---|---|
| data_verified | Datenquelle, Zeitpunkt und Zeitebene geprüft | nein |
| endpoints_verified | Geprüfte Anker und Endpunktregeln | allein nein |
| structure_verified | Alle für den behaupteten Pattern-Typ erforderlichen Belege geprüft | ja, innerhalb des dokumentierten Prüfumfangs |
| conditional | Eine erforderliche Teilstruktur oder Bestätigung fehlt | nein |
| rejected | Widerspruch oder Regelverletzung | nein |
| invalidated / completed / expired | Szenario beendet | nein |

Eine KI-Aussage wie `subdivision_verified=true` ist kein Beleg. Erforderlich sind
prüfbare Unterwellen mit eigenen Ankern und einem maschinellen Prüfprotokoll.

## 1. Fachvertrag und Abdeckung

Ein versioniertes Regelverzeichnis trennt harte Regeln, typische Beziehungen
und offene Interpretationsfragen. Jede Regel nennt Muster, Anwendungsvoraussetzungen,
Belege, Gegenbeispiele und Prüfroutine. Regeln dürfen nicht unbemerkt auf andere
Muster übertragen werden. Beispielsweise ist eine Überlappung kein ausreichender
Diagonalenbeweis, und eine überschießende B nicht bei jeder Korrektur verboten.

Abzudecken sind mindestens Impulse, ausdrücklich belegte Diagonalen, Zigzags,
Flats einschließlich ihrer Varianten, Dreiecke und Kombinationen. Nicht unterstützte
Formen bleiben ausdrücklich ungeprüft. Eine unvollständige Welle wird nicht anhand
von Voraussetzungen bewertet, die erst nach ihrem Abschluss feststehen können.

Es gibt kein erzwungenes Mindest-Retracement und keinen vorgegebenen Monatscount.
Quelle und News bleiben von Methodenwissen und eigener Kursanalyse getrennt.

## 2. Daten und strukturierter Beweis pro Count

Die Kette lautet: überprüfte Kerzen -> mehrere mögliche Swing-Strukturen ->
Count-Kandidaten -> unabhängige Berechnung und Regelprüfung -> Interpretation ->
Veröffentlichungsprüfung. Swing-Erkennung bestimmt nicht automatisch einen
einzigen richtigen Count; alternative plausible Segmentierungen bleiben prüfbar.

Jeder Count liefert:

- Markt, Datenquelle, Instrumenttyp, Datenstand und verwendete geschlossene Kerzen;
- Zeitebene und Wellengrad als getrennte Angaben;
- Pattern-Typ, Elternstruktur und bereits sichtbare Unterwellen;
- exakte Anker mit Zeitpunkt, Preis und Bestätigungszeitpunkt;
- erfüllte, verletzte und noch nicht prüfbare Regeln;
- Fibonacci-Methode, Anker, Formel und Rolle jeder Marke;
- getrennte Auslöser für Bestätigung und Invalidierung;
- plausible Alternative und beobachtbare Kriterien für einen Wechsel;
- ausdrückliche Unsicherheiten statt unbelegter Sicherheit.

30M und Tageschart dürfen unterschiedliche Bewegungsrichtungen haben. Ihr
Zusammenhang muss belegt werden; einheitliche Richtung aller Zeitebenen ist
kein Ersatz für die Prüfung der jeweiligen Struktur.

## 3. Echte Rollenprüfung an unbekannten Charts

Der Wissenstest bleibt ein Vorfilter. Darauf folgen fachlich geprüfte
Referenzfälle mit akzeptablen Alternativen und dokumentierten Streitfällen.
KI-Mehrheitsentscheidungen allein sind keine fachliche Referenz.

Vorgeschlagener Beginn: 50 Entwicklungsfälle und ein davon getrenntes,
zurückgehaltenes Prüfset von mindestens 50 weiteren Marktzeitpunkten. Enthalten
sind Trends, Korrekturen, Ranges, mögliche Diagonalen, unvollständige Muster,
mehrdeutige Fälle und gezielt ungültige Vorschläge. Die Fälle decken Monats-,
Wochen-, Tages-, 4H- und 30M-Daten ab. Diese Stichprobe ist ein Pilot und kein
umfassender Nachweis für jedes Instrument und jede Marktphase.

Die jeweilige Rolle muss ihre eigentliche Aufgabe lösen: Struktur lesen,
Fibonacci-Anker prüfen, einen fehlerhaften Gegenfall verwerfen oder eine
korrekte Synthese erstellen. Ihr Ergebnis muss inhaltlich und als strukturierte
Entscheidung übereinstimmen. Ein JSON-Fehler wird getrennt von einem fachlichen
Fehler bewertet.

Das Prüfset bleibt von Beispielen und Feedback getrennt, die zur Verbesserung
der Prompts verwendet werden. Nach einer Korrektur wird an neuen Fällen geprüft.
Wiederholung derselben Fragen bis zum Bestehen ist keine Qualifikation.

## 4. Zeitlicher Verlauf und Prognosequalität

Historische Daten werden schrittweise bis zu einem vorgegebenen Zeitpunkt
freigegeben. Erst anschließend wird die nächste Kerze sichtbar. Es gibt keinen
Zugriff auf spätere Pivots, spätere Quellen oder den später bekannten Verlauf.

Zu prüfen sind insbesondere:

- rechtzeitiges Verwerfen eines gebrochenen Counts;
- keine Reaktivierung durch spätere Kurserholung;
- nachvollziehbarer Wechsel zwischen vorab dokumentierten Alternativen;
- Trennung zwischen Zielkontakt, möglichem Boden und bestätigtem Einstieg;
- unveränderte Historie früherer Aussagen und ihrer Fehler.

Eine verlorene Prognose ist nicht automatisch ein fachlich falscher Count.
Eine zufällig erfolgreiche, regelwidrige Prognose bleibt ein Fehler. Die
Auswertung trennt Regelqualität, Datentreue, Enthaltungen, Prognosequalität und
Wahrscheinlichkeitskalibrierung. Häufiges WARTEN allein darf nicht als hohe
Analysequalität gewertet werden; die Abdeckung muss ebenfalls berichtet werden.

## 5. Freigabe und laufende Kontrolle

Vor Veröffentlichung braucht jeder Count vollständige Freigabe für den behaupteten
Prüfumfang. Offene Strukturbeweise blockieren die Kennzeichnung als bestätigt.
Keine Teamleitung, kein Supervisor und keine Mehrheit darf einen harten Befund
überstimmen. Text, Chart und Meldung entstehen aus demselben geprüften Objekt.

Die Rollenfreigabe bindet Rolle, Modellversion soweit verfügbar, Prompt-Version,
Regelversion und Benchmark-Version. Eine neue Konfiguration erbt keine Freigabe
allein wegen desselben Modellnamens. Veränderungen erfordern erneute Prüfung.

Vorab festzulegende Freigabekriterien:

- kein veröffentlichter Verstoß gegen eine implementierte harte Regel;
- keine erfundenen Kursanker oder Rechenwege;
- vollständiger Nachweis aller Pflichtfelder und beanspruchten Strukturen;
- alle gezielt ungültigen Referenzfälle blockiert;
- fachlich akzeptable Haupt-/Alternativcounts im zurückgehaltenen Set;
- ausgewiesene Antwortabdeckung und Fehlerquote mit Stichprobengröße;
- messbarer Nutzen gegenüber der vorab definierten einfachen Referenz.

Interpretative Qualitätsgrenzen werden vor Einsicht in die Prüfresultate
festgelegt und fachlich überprüft. Eine beliebig gewählte Trefferquote oder
eine einzelne bestandene Stichprobe gilt nicht als Sicherheitsgarantie.

Danach folgt mindestens der im Umbauplan vorgesehene vierwöchige Schattenbetrieb.
Harte Fehler lösen eine Sperre und einen nachvollziehbaren Fehlerfall aus.
Korrekturen benötigen einen Regressionstest und eine neue Freigabe. Ungeprüfte
Selbständerungen der Methodenbibliothek sind ausgeschlossen.

## Nächster Umsetzungsschritt

Die Trennung von Endpunktprüfung und vollständiger Strukturprüfung ist die
unmittelbare Absicherung. Danach die fehlende Strukturprüfung implementieren,
die Musterabdeckung dokumentieren und die Referenzfälle aufbauen. Anschließend
folgt der begrenzte historische Pilot und Schattenvergleich
gemäß `umbau.md`. Dieser Abnahmeplan startet keinen kostenpflichtigen Batch und
aktiviert nicht die isolierte Phase-1-Engine.

## Primäre Fachreferenzen

- https://www.elliottwave.com/waveopedia/impulse/
- https://www.elliottwave.com/waveopedia/corrective-waves/
- https://www.elliottwave.com/waveopedia/elliott-wave-pattern-diagonals/
- https://www.elliottwave.com/waveopedia/zigzags/
- https://www.elliottwave.com/waveopedia/flats/
