/* ============================================================================
   instanz.js — Konfiguration der öffentlichen DEMO.
   Gebaut aus instanz.example.js; demo:true schaltet Zugangsschutz und
   Einrichtungs-Assistent aus und blendet das Demo-Band ein.
   ============================================================================ */
window.COMPASS_INSTANZ = {
  version: 1,
  demo: true,
  kunde: 'Demo',
  name: 'Alex',
  produkt: 'Flow Compass',
  claim: 'Know what matters next',
  mail: 'du@example.com',
  kontaktMail: 'contract@vishnuartists.com',

  /* Kaufweg der Demo: die Produktseite auf der Live-Domain. Der Knopf
     „Einrichten lassen" haengt sein eigenes #kaufen an. */
  kaufUrl: 'https://vishnuartists.com/flow-compass.html',

  /* Solo-Modus: kein Server, alles im Browser. Genau so fühlt sich die Demo an. */
  api: '',
  gate: { salt: '', hash: '', tage: 30 },

  board: {
    wip: 3, alter: [3, 7],
    listen: {
      bereit: /^(sofort|heute|jetzt|ready|next|to ?do|bereit|diese woche)/i,
      wartet: /^(waiting|wartet|warten|blocked|blockiert|feedback|delegiert)/i,
      doing: /^(doing|in arbeit|in progress|läuft)/i,
      done: /^(done|erledigt|fertig)/i,
      bald: /^(n[äa]chste woche|bald|soon)/i
    }
  },

  /* Vier Kontexte einer selbstständigen Beraterin */
  kontexte: [
    { slot: 1, name: 'Kunden', icon: '🏢', farbe: '#1a44ea', jira: 'ops', trello: 'arbeit',
      worte: ['kunde', 'workshop', 'angebot', 'retro', 'team nord', 'onboarding', 'termin', 'begleitung'] },
    { slot: 2, name: 'Wachstum', icon: '🌱', farbe: '#89c527', jira: '', trello: '',
      worte: ['blog', 'artikel', 'newsletter', 'netzwerk', 'sichtbarkeit', 'akquise', 'website'] },
    { slot: 3, name: 'Privat', icon: '🏠', farbe: '#e8734a', jira: '', trello: 'privat',
      worte: ['lauf', 'sport', 'familie', 'urlaub', 'lernen', 'gesundheit', 'haushalt'] },
    { slot: 4, name: 'Finanzen', icon: '💰', farbe: '#f0b429', jira: '', trello: '',
      worte: ['rechnung', 'steuer', 'beleg', 'budget', 'auslastung', 'honorar'] }
  ],

  trello: {
    privat: { label: 'Mein privates Board', url: '' },
    arbeit: { label: 'Team-Board', url: '' }
  },
  jira: { browse: '', board: '', keys: ['OPS', 'PROJ'] },

  /* Flight Levels: in der Demo nur als Ausblick — die Karte beschreibt, was hier
     stuende, und holt bewusst KEINE Daten. Bis 24.08.2026 stand hier
     daten:'va-data.json'; weil die Demo auf derselben Domain liegt wie das
     Team-Cockpit, hat das Schaufenster damit 599 echte Jira-Vorgaenge samt
     Klarnamen an jeden Besucher ausgeliefert (verwandt: VA-13483, VA-13506). */
  team: {
    an: true,
    label: 'Team-Kanban · Flight Levels',
    url: '',
    daten: '',
    jiraBase: '',
    entries: [
      ['🏠', 'Startansicht', 'Ranglisten, Coach, Meeting-Guide', 'start'],
      ['👤', 'Meine Übersicht', 'Kennzahlen, nächste Schritte, Level', 'me'],
      ['📊', 'Team-Cockpit', 'Gesamtsystem · Ampeln & Charts', 'team'],
      ['⏳', 'Aging Board', 'Daily: rechts nach links, Blocker zuerst', 'aging'],
      ['🛫', 'FL2+3 · Verantwortung', 'Initiativen & Key Results pflegen', 'fl2'],
      ['🧠', 'Coach-Challenge', 'Kanban-Trainer · XP sammeln', 'ziff']
    ]
  },

  module: { kennzahlen: true, coach: true, social: false, konnektoren: true },

  /* In der Demo ist nichts wirklich verbunden — der Ausblick zeigt, was ginge. */
  konnektoren: {}
};
