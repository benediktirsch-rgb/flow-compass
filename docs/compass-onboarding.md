# Flow Compass — Routine für neue Kundinnen und Kunden

> Von der Zahlung bis zur Übergabe. Zusage an die Kundschaft: **fertig innerhalb von vier Wochen ab
> Zahlungseingang**. Diese Datei ist die Checkliste — dieselbe Liste steht auch im Jira-Ticket, das
> `compass-start.php` beim Absenden des Fragebogens anlegt (Label `compass-setup`, Fälligkeit +28 Tage).

## Das Produkt in drei Sätzen

Der Flow Compass ist ein persönliches Kanban-Cockpit für **eine** Person (Flight Level 1). Verkauft wird
keine Datei, sondern eine **eingerichtete Instanz mit Begleitung**. Die Instanz läuft zunächst bei uns; wer
später selbst hosten will, bekommt Dateien und Anleitung ohne Aufpreis.

Das Team-Gegenstück ist das **Flow Cockpit** (`site/`, Flight Level 1–3). Beide gehören zusammen: im Compass
schaltet man mit einer Taste vom eigenen Board auf das Team-Board um.

## Die Preisleiter (Entscheidung Bene 20.08.2026)

Eine Logik für alle Stufen: **nach Flight Level bepreist, Coaching immer dabei, nie eine Lizenz.** Der
kostenlose Einstieg sind die Demos (`flow-cockpit-starter.html`, `compass-demo/`), kein Billigtarif.

| Stufe | Für wen | Einrichtung | Betrieb |
|-------|---------|-------------|---------|
| **Flow Compass** | eine Person (FL1) | 490 € (erste vier: 190 €) | 29 € / Monat |
| **Flow Cockpit** | Team bis 15 (FL1–3) | 1.200 € | 99 € / Monat |
| **Flow Crew** | Team + bis zu 8 persönliche Compasses | 1.900 € | 179 € / Monat |
| **Enterprise** | > 15 Personen, mehrere Value Streams | auf Anfrage | auf Anfrage |

Jahreszahlung: **zehn statt zwölf Monate**. Alle Preise brutto, inkl. 19 % MwSt.

Warum so: Die Trainings liegen bei 1.100–2.600 € (`f/courses.js`). Ein Team-Werkzeug für 4,99 € daneben las
sich nicht als günstig, sondern als wertlos — und der persönliche Compass kostete monatlich mehr als das
Team-Cockpit. Die Einrichtungspreise liegen jetzt knapp unter den vergleichbaren Trainings, der Monatspreis
des Cockpits entspricht rund 15 € pro Person im Zehnerteam (Marktband für Flow-Analytics: 10–40 € pro Person),
und der Compass steht neben Sunsama/Motion (20–30 €/Monat) — die haben nur keinen Menschen dabei.

**Was in der Einrichtung steckt** (das ist der eigentliche Wert, nicht die Konfigurationsdatei):
Erstgespräch 90 Min · gebaute Instanz mit Quellen und Zugangsschutz · Übergabe 60 Min · 30 Tage
Nachbetreuung. Im Monatspreis: Betrieb, Updates, Support und eine Nachjustierung je Quartal (beim Cockpit:
eine begleitete Flow Review im Monat).

**Abgeschafft am 20.08.2026:** das Flow-Cockpit-Abo für 4,99 €/Monat und der Einmalkauf für 49 € (beides
PayPal). Bestandskundschaft behält alles: laufende PayPal-Abos laufen weiter, gekaufte Dateien funktionieren
unverändert, und wer den Compass zum alten Pilotpreis von 10 € bekommen hat, behält ihn — Stripe-Abos tragen
ihren Preis in sich, eine Änderung in `flow-checkout.php` wirkt nur auf neue Abschlüsse.

---

## Die Kette im Überblick

| # | Schritt | Wer | Wann | Werkzeug |
|---|---------|-----|------|----------|
| 1 | Kauf über Stripe | Kundin | Minute 0 | `f/flow-checkout.php` |
| 2 | Fragebogen ausgefüllt | Kundin | Tag 1–3 | `f/compass-start.html` → Jira-Ticket |
| 3 | Erstgespräch, 90 Min | beide | Woche 1–2 | Kalender |
| 4 | Instanz bauen und füllen | wir | Woche 2–3 | `build-compass-produkt.ps1 -Instanz` |
| 5 | Ausrollen und prüfen | wir | Woche 3 | Deploy, siehe unten |
| 6 | Übergabe: erster Morgencheck | beide | Woche 4 | 60 Min remote |

---

## 1 · Kauf (läuft automatisch)

`https://vishnu-artists.de/personal-compass.html#kaufen` bzw. `https://naturnah-lernen.de/f/flow-compass.html#preis`
führen auf `f/flow-checkout.php?produkt=compass&paket=standard|early`. Das Team-Cockpit und die Crew kauft
man von `https://vishnu-artists.de/#kaufen` aus über dieselbe Datei mit `?produkt=cockpit` bzw. `?produkt=suite`
(der Schlüssel heißt weiter `suite`, damit veröffentlichte Links tragen — angezeigt wird „Flow Crew").

Der Endpunkt legt **eine** Stripe-Checkout-Session an, `mode=subscription`:

* Posten 1 — Einrichtung, einmalig (49000 / 19000 / 120000 / 190000 Cent brutto)
* Posten 2 — Betrieb, 2900 / 9900 / 17900 Cent brutto pro Monat (bei `?zahlweise=jahr`: mal zehn, Intervall Jahr)

Die Preise stehen als `price_data` in der Tabelle `$PRODUKTE` oben im Skript; im Stripe-Konto muss **nichts**
vorbereitet werden. Preisänderung = eine Zeile in `flow-checkout.php`. Die alte `compass-checkout.php` ist nur
noch eine Weiterleitung (setzt `produkt=compass`), damit veröffentlichte Links weiter funktionieren.

**Pilotplätze:** `?status=1` zählt bei Stripe die Abos mit `metadata['produkt']='compass'` und
`metadata['paket']='early'` (5 Minuten zwischengespeichert in `compass-pilot-cache.php`). Sind alle vier weg,
schaltet auch der Direktlink `?paket=early` auf den Standardpreis um. Außerhalb von Stripe vergebene Plätze
trägst du in `feedback-config.php` als `$COMPASS_PILOT_VERGEBEN` nach.

**Voraussetzung:** In `f/feedback-config.php` muss `$STRIPE_SECRET` gesetzt sein (dieselbe Variable, die
Buchungen schon nutzen). Fehlt sie, antwortet der Endpunkt sauber mit „Zahlung ist gerade nicht eingerichtet“
und der Bitte, uns zu schreiben — kein kaputter Kauf.

Zahlungseingang, Rechnung und Ticket-Kommentar erledigen wie gehabt `stripe-webhook.php` (Signaturprüfung,
`$STRIPE_WEBHOOK_SECRET`) bzw. `zahlung.php` bei der Rückkehr aus dem Checkout. Der Compass braucht dafür
keine eigene Logik.

## 2 · Fragebogen (läuft automatisch)

`success_url` führt auf `f/compass-start.html?sid=<CHECKOUT_SESSION_ID>&produkt=<stufe>`. Die Seite

* prüft den Zahlungsstatus **serverseitig** über `zahlung.php` (die Wahrheit liegt bei Stripe, nie beim Browser)
  und zeigt bei SEPA ehrlich „dauert ein bis zwei Tage“,
* fragt zehn Dinge ab: Name und Anrede, Rolle, bis zu vier Kontexte mit Stichwörtern, Quellen, WIP-Limit,
  Team-Cockpit ja/nein, „was nervt dich am meisten“ und die Wunschzeit fürs Erstgespräch.

`compass-start.php` schreibt daraus: Inbox-Zeile (`compass-inbox.php`, Backup), Bestätigungsmail an die Kundin,
Kopie an uns und ein Jira-Ticket im aktiven Sprint mit genau dieser Checkliste.

> **Zugangsdaten werden hier nicht abgefragt.** Trello- und Jira-Token holen wir im Erstgespräch und legen sie
> als Umgebungsvariablen auf dem Server ab. Sie dürfen nie in `instanz.js`, nie in ein Repo, nie in den Browser.

## 3 · Erstgespräch (90 Minuten)

Das ist der eigentliche Wert der Einrichtung — nicht das Ausfüllen einer Konfigurationsdatei.

1. **Kontexte schärfen.** Vier Plätze, mehr nicht. Häufigster Fehler: zu feine Aufteilung. Lieber „Kunden“
   als drei Kundennamen.
2. **Stichwörter festlegen.** Sie entscheiden, wohin eine Karte automatisch sortiert wird — Titel zählt
   dreifach. Wir gehen zusammen durch echte Aufgaben aus ihrem Trello/Jira und schauen, wo sie landen.
   Was zu keinem Kontext passt, bleibt überall sichtbar; der Compass versteckt nie Arbeit.
3. **WIP-Limit ehrlich setzen.** Drei ist die Empfehlung. Wer fünf verlangt, bekommt fünf — und den Hinweis,
   in vier Wochen noch einmal draufzuschauen.
4. **Quellen verbinden.** Trello-Board-URLs, Jira-Adresse und Projektkürzel; Token setzen wir gemeinsam,
   direkt im Gespräch.
5. **Team-Cockpit klären.** Nutzt das Team schon eins, verbinden wir es (`team.an = true`). Wenn nicht:
   ausgeschaltet lassen — ein leeres Team-Board hilft niemandem.

## 4 · Instanz bauen

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1 -Instanz "Muster GmbH"
```

Baut nach `instanzen\muster-gmbh\`:

* `index.html` — die Produktversion von `dashboard.html`. Der Build ersetzt alles Persönliche durch die
  Instanz-Konfiguration und prüft zum Schluss, dass keine unserer Eigennamen mehr in der Datei stehen.
  **Schlägt ein Anker fehl oder findet die Wortprüfung etwas, bricht der Build ab** — es wird nie eine halb
  anonymisierte Datei ausgeliefert.
* `instanz.js` — aus `produkt/compass/instanz.example.js`, mit dem Kundennamen vorbelegt.
  **Existiert die Datei schon, wird sie nicht überschrieben** (Neubau nach einem Update ist gefahrlos).
* `dashboard-data.js`, `rhythmus-data.js`, `kennzahlen-data.js` — beim ersten Bauen aus den Demo-Daten,
  danach unangetastet.
* `compass-produkt.js`, `compass-produkt.css`, `kennzahlen.html`.

Dann `instanz.js` ausfüllen. Die Datei ist durchkommentiert; das Wesentliche:

| Feld | Was hinein gehört |
|------|-------------------|
| `eingerichtet` | Auf `true`, sobald die Datei fertig ist. Sonst geht bei der Kundin beim ersten Öffnen der Einrichtungs-Assistent auf — sie sieht einen Fragebogen statt ihres Cockpits (⚙️ im Kopf öffnet ihn weiterhin) |
| `kunde`, `name`, `mail` | Instanzname (steht im Fuß), Anrede im Kopf, Ziel der „schick mir …“-Knöpfe |
| `api` | Adresse des Compass-Servers. Leer = Solo-Modus (alles im Browser, keine Quellen). `'same-origin'`, wenn der Server die Seite selbst ausliefert |
| `gate` | `hash` = SHA-256(salt + Zugangswort). Erzeugen: Instanz im Browser öffnen, Konsole, `compass.hash('das Zugangswort')`. Leerer Hash = kein Schutz (nur für die Demo richtig) |
| `kontexte` | Bis zu vier, aus dem Erstgespräch. `slot` 1–4 nicht umbenennen — das sind die Farbplätze |
| `trello`, `jira` | URLs und Projektkürzel. **Keine Token** |
| `team` | `an: true` nur, wenn das Team-Cockpit wirklich existiert |
| `board.wip` | Aus dem Gespräch |

Danach die Datenschicht entdemoisieren: `dashboard-data.js` bekommt die echten Kontext-Inhalte
(`kontexte.va/vk/pr/fi` → `next`, `termine`, `vorbereiten`) und `projekte` bzw. `projekteListe` der Kundin.
`kennzahlen-data.js` bleibt schlank — **keine erfundenen Kacheln**: was keine Quelle hat, steht auf „–“.

## 5 · Ausrollen und prüfen

Vor der Übergabe diese Liste durchgehen:

- [ ] `index.html` öffnen: keine Konsolenfehler, Reiter tragen die Kundennamen, Farben stimmen
- [ ] Einrichtungs-Assistent erscheint **nicht** mehr (`eingerichtet: true` in `instanz.js`; im eigenen Browser zusätzlich `compassSetupFertig`), ⚙️ im Kopf öffnet ihn trotzdem
- [ ] Zugangsschutz greift von außen und nicht auf localhost; Zugangswort funktioniert
- [ ] Karte „🔌 Verbundene Werkzeuge“ zeigt den richtigen Stand — angebundene Quellen auf `an` setzen
      (`konnektoren: { trello:'an', jira:'an' }` in `instanz.js`)
- [ ] Mein Board zieht Karten aus den Quellen und schreibt eine Testkarte zurück (verschieben und ✓)
- [ ] Morgencheck, Abendcheck und die Rückfragen laufen durch
- [ ] Bei Solo-Instanzen: keine `/api/`-Aufrufe in der Konsole (der Build fängt sie ab)
- [ ] Server-Zugänge liegen als Umgebungsvariablen, nicht in Dateien

## 6 · Übergabe (60 Minuten)

Nicht „hier ist der Link“, sondern gemeinsam den **ersten Morgencheck** machen. Danach zeigen:

* das WIP-Limit und was passiert, wenn man es reißt,
* Kontexte umschalten (Tasten 1–4, `0` für alle, Strg+Klick kombiniert),
* eine Karte anlegen — im Compass, in Trello oder als Vorgang,
* „⤓ Fortschritt sichern“ / „⤒ Einspielen“ für den Rechnerwechsel,
* ⚙️ Einrichtung: dass sie selbst Kontexte, Stichwörter und WIP ändern kann,
* wie das Abo gekündigt wird und was danach bleibt.

Zum Schluss: Zugangsdaten übergeben, Termin für ein Nachgespräch in vier Wochen anbieten.

---

## Updates einspielen

Der Compass wird weiterentwickelt. Ein Update je Instanz:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1 -Instanz "Muster GmbH"
```

Der Build überschreibt `index.html`, `compass-produkt.js/.css` und `kennzahlen.html` — `instanz.js` und die
Datenschicht bleiben unangetastet. Bricht der Build mit `ANKER FEHLT` ab, hat sich `dashboard.html` an dieser
Stelle geändert: den Anker im Build-Skript nachziehen, **nicht** die Prüfung entfernen. Genau dafür ist sie da.

Der Fortschritt der Kundin (Karten, XP, Antworten) liegt im localStorage ihres Browsers und übersteht jedes
Update.

## Wenn etwas schiefgeht

| Symptom | Ursache | Behebung |
|---------|---------|----------|
| Build bricht mit `ANKER FEHLT` ab | `dashboard.html` hat sich geändert | Anker im Build-Skript nachziehen |
| Build bricht mit `WORTPRUEFUNG` ab | neuer persönlicher Text in der Quelle | Ersetzung in Abschnitt 16/16b ergänzen |
| Kundin sieht den Assistenten immer wieder | `eingerichtet` steht nicht auf `true` (`compassSetupFertig` lebt nur in ihrem Browser) | `eingerichtet: true` in `instanz.js` setzen und neu ausliefern |
| Board bleibt leer | kein Server oder Token abgelaufen | `api` prüfen, Umgebungsvariablen erneuern |
| Karte zeigt „⌂ lokal“ | Rückschreiben scheitert | Der Toast nennt den Grund; bei Trello meist ein Nur-Lese-Token |
| Zahlung ohne Fragebogen | Kundin hat abgebrochen | Ticket-Inbox `compass-inbox.php` prüfen, per Mail nachfassen |

## Dateien

| Datei | Wozu |
|-------|------|
| `build-compass-produkt.ps1` | Produkt-Build (Demo und Kundeninstanzen) |
| `produkt/compass/instanz.example.js` | Vorlage der Instanz-Konfiguration |
| `produkt/compass/compass-produkt.js` | Produktschicht: Konfiguration, Assistent, Konnektoren |
| `produkt/compass/compass-produkt.css` | Stile für Assistent und Demo-Band |
| `produkt/compass/demo/*` | Demo-Instanz und Demo-Daten |
| `site/personal-compass.html` | Verkaufsseite auf vishnu-artists.de |
| `site/compass-demo/` | öffentliche Demo (gebaut, nicht von Hand ändern) |
| `f/flow-checkout.php` | Stripe-Kaufstrecke aller drei Stufen, Preistabelle, Pilotplatz-Zähler |
| `f/compass-checkout.php` | Weiterleitung auf flow-checkout.php (alte, schon veröffentlichte Adresse) |
| `f/compass-start.html` + `.php` | Einrichtungs-Fragebogen → Jira-Ticket |
| `f/flow-compass.html` | Produktseite auf der neuen Website (Variante F) |
