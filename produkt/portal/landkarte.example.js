/* ============================================================================
   landkarte.js — die Sternenkarte einer Brücke (Schema + neutrales Beispiel, 11.09.2026)

   Diese Vorlage wird NICHT automatisch kopiert. Eine Sternenkarte ist persönlich: wer eine
   will, legt landkarte.js von Hand neben portal.js an die Wurzel seiner Subdomain. Benes
   eigene Fassung pflegt der Skill „nordstern-landkarte“ (~/.claude/skills/…/landkarte.js),
   publish-compass.ps1 kopiert sie vor jedem Build nach site/compass/.

   Wer die Datei liest:
     • landkarte-ansicht.js auf der Brücke (Abschnitt #sternenkarte, #stern-<id>)
     • das Holodeck im Compass: <script src="/landkarte.js"> → window.LANDKARTE
       (gleicher Ursprung, liegt hinter gate.php — nie in ein Repo, nie in die Demo kopieren)

   Regeln für den Inhalt:
     • Jeder Text darf ein String sein oder { de:'…', en:'…' }.
     • stand: 'laeuft' | 'offen' | 'wackelt' | 'steht' | 'erreicht' | 'idee'
     • Datumsangaben 'JJJJ-MM' oder 'JJJJ-MM-TT'.
     • projekte[].jetzt: true oder eine Zahl (1 = zuerst) → erscheint in „Jetzt auf Kurs“.
     • Namen in verantwortlich/beteiligt genau so schreiben wie in menschen[].name —
       daran hängt der Filter „Was an … hängt“.
     • Keine Zugangsdaten, keine Kontonummern, keine Beträge, die nicht jede Person
       sehen darf, die diese Brücke öffnet.
   ============================================================================ */
window.LANDKARTE = {
  version: 1,
  stand: '2026-09-11',

  /* Der eine Satz. kurz = Beschriftung im Himmel (max. ~24 Zeichen). */
  nordstern: {
    titel: 'Ein gutes Leben, das andere stärker macht',
    kurz: 'Gutes Leben',
    satz: 'Menschen befähigen, Zeit für mich und neue Ideen haben — ohne Geld- und Gesundheitssorgen.'
  },

  /* Leitplanken: gelten für jeden Stern, entscheiden bei Konflikten. */
  prinzipien: [ 'Gesundheit vor Umsatz', 'Wochenende gehört der Familie' ],

  /* Mini-Nordsterne — 4 bis 7 Lebensbereiche. farbe: gruen · violett · bernstein · himmel · rose · tuerkis */
  sterne: [
    { id: 'gesund', icon: '🌿', farbe: 'gruen', titel: 'Gesund und voller Energie', kurz: 'Gesundheit',
      untertitel: 'Mini-Nordstern',
      satz: 'Der Körper trägt alles andere.',
      kennzeichen: [ { was: 'Energie im Morgencheck', ziel: '≥ 7 von 10', quelle: 'Compass-Blüte Energie' } ],
      ziele: [
        { id: 'sport', titel: 'Dreimal pro Woche Sport', bis: '2026-12', messung: 'Einheiten je Woche', stand: 'offen',
          initiativen: [
            { titel: 'Feste Sportfenster im Kalender', verantwortlich: 'Alex', beteiligt: [], stand: 'offen',
              projekte: [ { titel: 'Kalenderserie anlegen', wo: 'Kalender', link: '', stand: 'offen',
                            naechster: 'Drei Termine für nächste Woche setzen', jetzt: 1 } ] }
          ] }
      ] }
  ],

  /* Die Landkarte dahin: Etappen mit Meilensteinen, stern = id oben. */
  route: [
    { titel: 'Jetzt', satz: 'Herbst 2026', meilensteine: [ { titel: 'Sportfenster stehen', stern: 'gesund', bis: '2026-10' } ] },
    { titel: '2027', satz: 'Stabil', meilensteine: [] }
  ],

  menschen: [ { name: 'Alex', rolle: 'trägt alles' } ],

  spannungen: [ { satz: 'Mehr Kunden kosten Zeit.', regel: 'Neue Mandate nur, wenn die Sportfenster bleiben.' } ],

  /* Optional: Hinweise fürs Holodeck (Szenen, in denen die Karte vorkommt). Die Ansicht
     auf der Brücke ignoriert diesen Block. */
  holodeck: { szenen: [] }
};
