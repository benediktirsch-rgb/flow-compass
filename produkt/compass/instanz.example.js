/* ============================================================================
   instanz.js — die EINE Datei, in der alles Persönliche einer Compass-Instanz
   steht. Der Rest des Compass ist Produkt und für alle Kundinnen gleich.

   Diese Datei wird beim Einrichten je Kundin aus instanz.example.js kopiert
   und ausgefüllt (Routine: docs/compass-onboarding.md). Wer nichts einträgt,
   bekommt beim ersten Öffnen den Einrichtungs-Assistenten — er schreibt
   dieselben Werte in den localStorage des Browsers (Schlüssel compassInstanz)
   und übersteuert diese Datei. „⚙️ Einrichtung“ im Kopf öffnet ihn erneut.

   Keine Geheimnisse hier hinein! Trello-/Jira-Token liegen ausschließlich im
   Server (john-server.ps1, Umgebungsvariablen), nie im Browser.
   ============================================================================ */
window.COMPASS_INSTANZ = {
  version: 1,

  /* true = wir haben diese Instanz fertig eingerichtet und ausgeliefert. Dann
     geht der Einrichtungs-Assistent beim ersten Öffnen NICHT von selbst auf
     (über ⚙️ im Kopf bleibt er erreichbar). Bei einer Kundeninstanz gehört der
     Schalter auf true, sobald unten alles ausgefüllt ist — sonst begrüßt die
     Instanz ihre Kundschaft mit einem Fragebogen, den wir im Erstgespräch
     schon beantwortet haben. */
  eingerichtet: false,

  kunde:  'Demo GmbH',            /* nur für uns: Instanzname, taucht im Fuß auf */
  name:   'Alex',                 /* Anrede im Kopf: „Guten Morgen, Alex“ */
  produkt:'Flow Compass',
  claim:  'Know what matters next',
  mail:   'du@example.com',       /* Ziel der „schick mir …“-Knöpfe */

  /* Server-Anbindung (optional). Leer = Solo-Modus: der Compass läuft rein im
     Browser, Board/Rituale/Fortschritt liegen im localStorage. Mit Adresse
     (z. B. http://localhost:8787 oder eine Instanz bei uns) kommen Trello,
     Jira und der Coach dazu. */
  api: '',

  /* Zugangsschutz für gehostete Instanzen. hash = SHA-256(salt + Passphrase);
     erzeugen in der Browser-Konsole:  compass.hash('meine Passphrase')
     Leerer hash = kein Schutz (richtig für die öffentliche Demo). Greift nie
     auf localhost. */
  gate: { salt: 'compass·2026·', hash: '', tage: 30 },

  /* 🧭 Mein Board (Personal Kanban nach Jim Benson): WIP-Limit für „In Arbeit“,
     Alters-Ampel in Tagen [gelb, rot], Zuordnung fremder Listennamen auf die
     fünf Spalten (RegExp auf den Listennamen, alles Übrige → Backlog). */
  board: {
    wip: 3, alter: [3, 7],
    listen: {
      bereit: /^(sofort|heute|jetzt|ready|next|to ?do|bereit|diese woche)/i,
      wartet: /^(waiting|wartet|warten|blocked|blockiert|feedback|delegiert)/i,
      doing:  /^(doing|in arbeit|in progress|läuft)/i,
      done:   /^(done|erledigt|fertig)/i,
      bald:   /^(n[äa]chste woche|bald|soon)/i
    }
  },

  /* Kontexte = die Lebensbereiche, zwischen denen du oben umschaltest.
     Genau vier Plätze (Tasten 1–4). Nicht gebrauchte Plätze einfach weglassen.
       slot   fester Platz + Farbslot (1..4) — bitte nicht umbenennen
       name   was du siehst
       icon   Emoji im Reiter
       farbe  Akzentfarbe des Platzes
       worte  Stichwörter: danach ordnet der Compass Karten/Zeilen automatisch
              diesem Kontext zu (Titel zählt dreifach). Klein schreiben.
       jira   Jira-Projektpräfix dieses Kontexts ('' = keins)
       trello Trello-Board-Schlüssel dieses Kontexts ('' = keins)          */
  kontexte: [
    { slot:1, name:'Arbeit',   icon:'🏢', farbe:'#1a44ea', jira:'ops',  trello:'arbeit',
      worte:['kunde','angebot','projekt','ticket','release','meeting','team'] },
    { slot:2, name:'Wachstum', icon:'🌱', farbe:'#89c527', jira:'',     trello:'',
      worte:['marketing','website','kampagne','social','newsletter','akquise'] },
    { slot:3, name:'Privat',   icon:'🏠', farbe:'#e8734a', jira:'',     trello:'privat',
      worte:['sport','familie','urlaub','lernen','kurs','gesundheit','haushalt'] },
    { slot:4, name:'Finanzen', icon:'💰', farbe:'#f0b429', jira:'',     trello:'',
      worte:['rechnung','steuer','budget','kosten','honorar','versicherung'] }
  ],

  /* Trello-Boards (der Server holt sie; die Schlüssel tauchen in kontexte.trello
     wieder auf). url = das Board im Web, damit „↗“ dorthin springt. */
  trello: {
    privat: { label:'Mein privates Board', url:'' },
    arbeit: { label:'Team-Board',          url:'' }
  },

  /* Jira (optional). browse = Präfix für Ticket-Links, board = dein Board,
     keys = Projektpräfixe, an denen der Compass Ticketnummern erkennt. */
  jira: { browse:'', board:'', keys:['OPS','PROJ'] },

  /* ✈️ Flight Levels — die Brücke zum Team-Cockpit.
     an:false → der Compass bleibt rein persönlich (Flight Level 1).
     an:true  → zweite Board-Ansicht mit FL1/FL2/FL3 aus dem Team-Cockpit. */
  team: {
    an: false,
    label: 'Team-Kanban · alle Projekte',
    url:   'https://vishnu-artists.de/va/',
    daten: 'va-data.json',
    jiraBase: '',
    entries: [
      ['🏠','Startansicht','Ranglisten, Coach, Meeting-Guide','start'],
      ['👤','Meine Übersicht','Kennzahlen, nächste Schritte, Level','me'],
      ['📊','Team-Cockpit','Gesamtsystem · Ampeln & Charts','team'],
      ['⏳','Aging Board','Daily: rechts nach links, Blocker zuerst','aging'],
      ['🛫','FL2+3 · Verantwortung','Initiativen & Key Results pflegen','fl2'],
      ['🧠','Coach-Challenge','Kanban-Trainer · XP sammeln','ziff']
    ]
  },

  /* Module an/aus — was nicht gebucht ist, wird gar nicht erst gerendert.
     `routinen` (31.08.2026) = die Karte „Deine Routinen“: zeigt, wann jede geplante Routine
     zuletzt wirklich gelaufen ist. Braucht den lokalen Server der Instanz; ohne ihn stünde
     dort dauerhaft „nicht erreichbar“ — darum in der Demo aus. */
  module: { kennzahlen:true, coach:true, social:false, konnektoren:true, wacht:false, routinen:false },

  /* Konnektoren: Status je Werkzeug. 'an' = eingerichtet, 'bereit' = im Produkt
     enthalten, nur noch zu verbinden, 'arbeit' = wir bauen daran,
     'geplant' = auf der Karte. Die Demo zeigt daraus den Ausblick. */
  konnektoren: {}
};
