# Tastatur im Flow Compass

Seit 11.09.2026. Umsetzung: `compass-tasten.js` (eine Datei, hängt sich von außen an Compass,
Kennzahlen, Kundenlage, Produkt-Kennzahlen und Focus View). Anlass: Im Abendcheck kam man mit
Return nicht weiter. Daraus ist ein Konzept für alle Seiten geworden. Wer ohne Maus arbeitet,
soll überrascht werden, wer mit Maus arbeitet, soll nichts davon merken.

## Eine Grammatik, überall gleich

| Taste | bedeutet |
|---|---|
| `⏎` | tut, was der farbige Knopf tut (Weiter, Anlegen, Schließen) |
| `⇧⏎` | neue Zeile, aber nur in Feldern mit `data-mehrzeilig` |
| `Strg ⏎` | schickt ab, auch aus mehrzeiligen Feldern |
| `Esc` | eine Ebene zurück, auch aus einem Feld heraus |
| `1`–`9` | die n-te Wahl: im Dialog die Antwort, auf einer Karte die Aktion, in der Focus View die Kachel |
| `←` `→` | zwischen Antworten wandern · `↑` `↓` zur nächsten Frage |
| `Alt ←` / `Alt →` | im Ritual einen Schritt zurück / weiter |
| Buchstaben | springen (M, A, R, N, K, J, B, F, S, E, L, D, C). Nie in Feldern, nie unter einem Dialog |
| `?` | Tastenhilfe, baut sich aus dem, was die Seite kann |

Neu dazugekommen: **R** Rückfragen, **N** neue Karte, **C** zurück zum Compass (Unterseiten), **?**.

## Drei Regeln, damit niemand gestört wird

1. **Unsichtbar für die Maus.** Ziffern-Plaketten erscheinen erst im Tastatur-Modus
   (`html[data-tastatur]`, gesetzt durch Tab/Taste, gelöscht durch den nächsten Klick) und nur,
   solange sie wirken: Steht der Cursor in einem Feld, tippen Ziffern, dann bleiben die Plaketten weg
   (`html[data-imfeld]`). Fokusrahmen laufen über `:focus-visible`.
2. **Enter löst nichts aus, wo der Fokus nur „gelandet“ ist.** Öffnet sich ein Schritt mit offener
   Wahl, liegt der Fokus auf der ersten Antwort, damit 1–9 sofort greifen. Enter dort geht weiter,
   **ohne** diese Antwort zu wählen. Erst wer sich selbst hinbewegt, wählt mit Enter.
   (Sonst hätte ein „einfach weiter“ im Abendcheck „✅ Fertig“ eingetragen oder im Freigabe-Schritt
   committet.)
3. **Tippen landet im Feld.** Steht der Fokus auf einer Antwort und man tippt einen Buchstaben,
   springt er ins Notizfeld und der Buchstabe steht dort. `2` → `porsche` → `⏎` ist ein Schritt.

Dazu: Strg/Alt/⌘ + Buchstabe gehört dem Browser. Vorher öffnete Strg+F neben der Suche den
Fokus-Modus und Strg+K die Kennzahlen.

## Anschluss: Attribute statt Code

| Attribut | wo | Wirkung |
|---|---|---|
| `data-tasten` | Dialog (`.ov`, `.modal`) | Enter, Alt+Pfeile, Ziffern, Esc-aus-Feld gelten hier |
| `data-primaer` | Knopf | den drückt Enter (sonst erster `.btn.a` / `.btn.p`) |
| `data-zurueck` | Knopf | den drückt Alt+← |
| `data-tasten-weiter` | Antwortgruppe | Enter wählt **und** geht weiter (Wahl-Schritte) |
| `data-mehrzeilig` | Textfeld | Enter macht eine neue Zeile, Strg+Enter schickt ab |
| `data-schliessen` | Knopf | den drückt Esc aus einem Feld (sonst `.sx`) |

Antwortgruppen erkennt die Ebene an `.opts`, `.routes`, `.zielrow`, `[data-tasten-optionen]`.
Die Fokusfalle (Tab kreist) gilt für jeden offenen `.ov.on` / `.modal.on`, auch ohne `data-tasten`.
Karten: `compassTasten.karten({karte, optionen, oeffnen})`. Für Mein Board ist das
`.pk .kc`, die Aktionen ohne 🗑 (Löschen fragt nicht nach und bekommt deshalb keine Ziffer).

**Wer einen neuen Dialog baut:** `data-tasten` an den Rahmen, `data-primaer` an den Hauptknopf.
Mehr braucht es nicht. Wer ein neues mehrzeiliges Feld baut, in dem Absätze Sinn ergeben:
`data-mehrzeilig`. Die Ritual-Felder („in einem Satz“) bleiben einzeilig, dort ist Enter = Weiter.

## Geprüft (11.09.2026, Preview `compass-dev`)

Abendcheck per A: Fokus auf „Fertig“, Plaketten 1–4. `2` + Tippen + `⏎` wählt „Halb“ und geht
auf Schritt 2. `⏎` auf der gelandeten Antwort geht weiter ohne Wahl. Esc aus dem Notizfeld schließt.
Rückfragen per R: `↓`/`→` wandern, Plaketten folgen der Karte. Tastenhilfe per `?`.
Fokusfalle im Ansichts-Assistenten. N öffnet „Neue Karte“ mit Fokus im Namen, Esc aus dem Feld
schließt. Mein Board: Karten fokussierbar, `↓` in der Spalte, `→` in die Nachbarspalte, Aktionen 1–3.
Strg+K bleibt auf der Seite. Kennzahlen: Enter im Meldefeld = Zeilenumbruch, Strg+Enter = Senden
(abgefangen, kein Ticket), Esc schließt. Produkt-Build mit Wortprüfung bestanden.

Falle für spätere Tests: In der Vorschau laufen CSS-Übergänge nicht weiter.
`getComputedStyle(#ovBack).visibility` bleibt dort auf `hidden`. `frei()` liest deshalb zuerst
`style.visibility`.
