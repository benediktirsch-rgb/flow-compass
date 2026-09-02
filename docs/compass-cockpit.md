# Flow Cockpit ⇄ Flow Compass — die beiden Produkte im Cockpit

> Ergänzt `docs/compass-onboarding.md` (Kauf → Fragebogen → Instanz). Hier steht der **zweite Zugang**:
> Menschen, die schon im Flow Cockpit angemeldet sind, kommen ohne Umweg über die Website zu ihrem
> persönlichen Compass. Der Verkaufsweg über die Website bleibt unverändert daneben bestehen.

## Warum das zusammengehört

Das **Flow Cockpit** (`site/va/`) zeigt den Fluss des **Teams** — Flight Level 1 bis 3, alle Diagramme,
zwei Ranglisten. Der **Flow Compass** ist die Ebene darunter: **eine** Person, Personal Kanban, „was ist
jetzt dran?“. Wer im Cockpit auf seine eigene Zeile schaut, hat genau die Frage, die der Compass
beantwortet. Darum stehen beide jetzt in einer durchgehenden Produktleiste — im Cockpit unter dem
Willkommens-Banner und in der Startansicht, im Compass in der Karte mit den Cockpit-Einstiegspunkten
(`COMPASS.cockpit.entries`).

Seit dem 27.08.2026 gehen beide Richtungen auch ohne Tab-Wechsel: der Compass bettet das Cockpit in
seiner Kanban-Karte ein (seit 20.08.), und das Cockpit öffnet den Compass als **Vollbild-Ebene im
Cockpit** (`vaApp.compass.oeffnen(go)` in `va-app.js`, iframe auf die eigene Instanz, Kopfleiste mit
den sechs Absprungpunkten über `?go=…`). Wer **keine** freigegebene Instanz hat, sieht dieselbe Ebene
**ausgegraut**: die Demo läuft stumm hinter Grau, davor steht der Weg zur eigenen Instanz (dieselben
Stände wie die Leiste). Auch die Leiste zeigt die Absprungpunkte dann grau statt gar nicht — jeder
Klick führt in die Vorschau. Im Porsche-Cockpit (`cs-carsales-flow-cockpit/pb-start.js`) steht der
Compass ebenfalls ausgegraut in der Startansicht — reiner Teaser ohne Funktion („bei Interesse:
Benedikt“).

## Ein Login für beide Werkzeuge — alle Wege (27.08.2026)

Angemeldet ist man immer in **beiden** Werkzeugen: Cockpit-Login (`va-app.js › anmelden()`) schreibt
auch `compassGate`/`compassUser`, das Compass-Gate (`dashboard.html › vaAnmelden()`) schreibt auch
`vaAuth_va2`/`vaUser_va`; Abmelden räumt auf beiden Seiten auf. Vier Wege hinein, an beiden Gates:

| Weg | Wie | Wo implementiert |
|-----|-----|------------------|
| Name + Team-Passwort | wie bisher (Salted-SHA-256 im Browser) | `va-app.js`, `dashboard.html` |
| Windows Hello / Fingerabdruck / Face | Geräte-Eintrag `compassBio` (WebAuthn, ein Eintrag für beide Gates); Angebot nach der ersten Anmeldung, Knopf am Gate | beide |
| Anmelde-Link per Mail | `f/flow-login.php` (Variante F): einmaliger Token, 30 Min, nur an freigegebene Adressen (gehasht, Salz `vf-login::`, plus Domain `@vishnuartists.com`); eingelöst über `?login=<token>` | beide + PHP |
| Passwort vergessen | derselbe Link — zusätzlich Meldung an `contract@` (rotieren kann nur Bene: `VA_PW_HASH` in va-app.js, `VA_LOGIN` in dashboard.html, ggf. `.htpasswd`-Secret, siehe `docs/va-zugangsschutz.md`) | beide + PHP |

Dazu Vorschläge beim Tippen: das Namensfeld hat an beiden Gates eine Datalist mit den Team-Namen
(Cockpit aus `PEOPLE`, Compass aus `va-data.json`), im Cockpit steht unter dem Feld live, **als wer
und in welcher Rolle** man angemeldet wird („✓ Anmeldung als: … · Rolle: Coach“).

Grenzen, ehrlich: `/va/` liegt zusätzlich hinter HTTP-Basic-Auth (erste Schicht, siehe
`va-zugangsschutz.md`) — der Anmelde-Link ersetzt nur die zweite; die Mail sagt das dazu. Neue
Adresse freigeben = Hash in `f/flow-login.php` (`$FREI_HASHES`) ergänzen oder serverseitig
`f/flow-login-freigaben.php` (gitignored) pflegen. Im Compass-**Produkt** erscheint der
Link-/Reset-Block nur, wenn die Instanz `teamLogin.hash` + `teamLogin.api` mitbringt.

## Die Kette aus dem Cockpit heraus

| # | Was passiert | Wer | Wo |
|---|--------------|-----|-----|
| 1 | Angemeldete Person klickt **🧭 Eigenen Compass einrichten** | sie | Produktleiste im Cockpit |
| 2 | Anfrage wird zum Jira-Vorgang (Label `compass-setup`, dir zugewiesen, aktueller Sprint) | automatisch | `f/compass-start.php` |
| 3 | Sofort danach: Einrichtungs-Assistent der Demo, sie konfiguriert **ihr Board selbst** | sie | `compass-demo/?demo=0` |
| 4 | Fertige Konfiguration geht als zweiter Vorgang an dich — mit Kontexten, Stichwörtern, Quellen, WIP | sie, ein Klick | Produktleiste → **📤 Zur Freigabe** |
| 5 | Instanz bauen und ausrollen | du | `build-compass-produkt.ps1 -Instanz "<Name>"`, siehe `compass-onboarding.md` ab Abschnitt 4 |
| 6 | **Freigabe:** Eintrag ins Register | du | `site/va/compass-register.json` |

Schritt 2 und 4 landen beide in **deinem** Compass: der Vorgang ist dir zugewiesen, und dein Board zieht
deine offenen Jira-Vorgänge über `/api/jira/meine`. Du siehst die Anfrage also da, wo du morgens ohnehin
hinschaust — ohne zusätzliche Benachrichtigung.

Der Assistent läuft in der Demo mit `?demo=0`: das nimmt der Demo die Demo-Fahne, dadurch startet der
Einrichtungs-Assistent von selbst (`compassSetup.noetig()`). Er öffnet sich in einem eigenen Tab, damit
das Cockpit stehen bleibt; beim Zurückwechseln bewertet die Leiste den Stand neu (`focus`-Ereignis).

Weil Cockpit und Compass auf **derselben Herkunft** liegen (`vishnu-artists.de`), liest das Cockpit die
fertige Konfiguration direkt aus `localStorage.compassInstanz`. Lokal auf zwei Ports geht das nicht — dann
bleibt der Stand bei „angefragt“, was ehrlich ist und nichts kaputt macht.

## Was die Leiste anzeigt

| Stand | Wann | Was die Person sieht |
|-------|------|----------------------|
| `neu` | kein Eintrag, keine Konfiguration | Demo-Link + **Eigenen Compass einrichten** |
| `angefragt` | Anfrage raus, Assistent noch nicht durch | Vorgangsnummer + **Board jetzt einrichten** |
| `konfiguriert` | Assistent durchgelaufen | **Zur Freigabe an Benedikt** + Board ändern |
| `warten` | Konfiguration übergeben | „Benedikt gibt frei“ + Vorgangsnummer |
| `aktiv` | Eintrag im Register (oder `?compass=<URL>`) | die sechs Absprungpunkte in den eigenen Compass |

## Deine Freigabe — der eine Schritt, der bei dir liegt

Die Nutzung ist erst frei, wenn die Instanz im Register steht. Nichts daran ist automatisch.

1. Instanz bauen und ausrollen (`compass-onboarding.md`, Abschnitte 4 und 5).
2. Im Cockpit anmelden, Browser-Konsole öffnen:

   ```js
   vaApp.compass.eintrag('Vorname Nachname', 'https://vishnu-artists.de/compass/kuerzel/')
   ```

3. Die ausgegebene Zeile in `site/va/compass-register.json` unter `instanzen` einfügen.
4. `git status --short` lesen → `git add site/va/compass-register.json` → committen → `git push origin main`.
5. Den Jira-Vorgang schließen. Beim nächsten Cockpit-Aufruf zeigt die Leiste dieser Person ihre
   Absprungpunkte.

Die Kennung im Register ist der gesalzene SHA-256 des Namens (derselbe Salt wie beim Team-Login), damit
im Netz keine Klarnamen-Liste steht. Der Zugangsschutz der Instanz liegt weiterhin in ihrer `instanz.js`
(`gate.hash`) — das Register ist öffentlich lesbar und darf **nie** Zugangsworte, Token oder E-Mail-Adressen
enthalten.

## Absprungpunkte in den Compass

Sechs Kennungen, gespiegelt zu den Cockpit-Einstiegspunkten (`?go=start|me|team|aging|fl2|ziff`):

`heute` · `schritte` · `board` · `arbeit` · `rhythmus` · `kennzahlen`

Empfangen werden sie von `compassGo()` in `dashboard.html` (und damit in jeder gebauten Instanz und in der
Demo): die Sektion wird aufgeklappt, angefahren und kurz hervorgehoben. `kennzahlen` führt auf
`kennzahlen.html`, `morgen` startet den Morgencheck. Unbekannte Kennungen tun nichts.

Weil `lotusLaden()` nach dem Datenladen neu rendert und dabei die Sektionen ersetzt, fasst `compassGo()`
nach 900 und 2400 ms noch einmal nach — aber nur, wenn die Sektion nicht ohnehin im Blick ist, damit es
niemanden zurückreißt, der schon weitergescrollt hat.

## Dateien

| Datei | Wozu |
|-------|------|
| `site/va/va-app.js` | Produktleiste, Stand, Anfrage-Dialog, Übergabe, Register-Abfrage (Abschnitt „Flow-Suite“) |
| `site/va/compass-register.json` | freigegebene Instanzen (gehashte Kennung → URL) |
| `dashboard.html` › `compassGo()` | Empfänger der Absprungpunkte, wandert über den Build in Demo und Instanzen |
| `f/compass-start.php` | nimmt Anfrage und Konfiguration entgegen, legt den Jira-Vorgang an |

## Grenzen, ehrlich

* Der Anfrage-Endpunkt liegt auf `naturnah-lernen.de`, das Cockpit auf `vishnu-artists.de` — der Aufruf ist
  bewusst herkunftsübergreifend (`Access-Control-Allow-Origin: *` steht im PHP). Zieht die Variante F auf
  eine andere Adresse um, muss `CP.anfrage` in `va-app.js` mit.
* Klemmt der Endpunkt, sagt der Dialog das und bietet den Mail-Weg an — der Stand springt **nicht** auf
  „angefragt“, damit niemand glaubt, es sei etwas rausgegangen. Das Board einrichten geht trotzdem.
* Die Preisfrage ist im Cockpit bewusst **nicht** beantwortet: die Leiste nennt keine Zahl. Für Kundschaft
  von außen gilt die Preisleiter aus `compass-onboarding.md` (Compass 490 € + 29 €/Monat, Team-Cockpit
  1.200 € + 99 €/Monat, Suite 1.900 € + 179 €/Monat).
