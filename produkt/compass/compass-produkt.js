/* ============================================================================
   compass-produkt.js — die Produktschicht des Flow Compass.

   Wird VOR dem Haupt-Skript geladen (der Build hängt es in den <head>) und
   stellt bereit:
     INST              die zusammengeführte Instanz-Konfiguration
                       (instanz.js  <  localStorage compassInstanz  <  ?demo)
     INST.ctx          die Kontexte auf den vier festen Farbslots va|vk|pr|fi
     compassSetup      der Einrichtungs-Assistent (erster Start + ⚙️ jederzeit)
     KONNEKTOREN       Werkzeug-Anbindungen inkl. ehrlichem Status
     konnektorCard()   die Karte „🔌 Verbundene Werkzeuge“ (Demo: der Ausblick)
     Demo-Coach        in der Demo (und nur dort) beantwortet der KI-Coach die
                       vier Schnell-Fragen mit einem aufgezeichneten Dialog
                       statt einer Offline-Meldung (VA-13505)

   Diese Datei kennt keine einzige Kundin und keinen einzigen Firmennamen —
   das ist der Punkt. Alles Persönliche steht in instanz.js.
   ============================================================================ */
(function () {
  'use strict';

  /* ---- 1. Konfiguration zusammenführen ---------------------------------- */
  const DATEI = window.COMPASS_INSTANZ || {};
  let GESPEICHERT = {};
  try { GESPEICHERT = JSON.parse(localStorage.getItem('compassInstanz') || '{}') || {}; } catch (e) { GESPEICHERT = {}; }

  const tief = (a, b) => {
    const o = Object.assign({}, a);
    Object.keys(b || {}).forEach(k => {
      const v = b[k];
      o[k] = (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof RegExp))
        ? tief(a && a[k] ? a[k] : {}, v) : v;
    });
    return o;
  };

  const INST = tief(DATEI, GESPEICHERT);
  INST.module = INST.module || {};
  INST.trello = INST.trello || {};
  INST.jira = INST.jira || {};
  INST.team = INST.team || {};
  INST.board = INST.board || {};
  INST.gate = INST.gate || {};

  /* Demo-Schalter: ?demo=1 erzwingt die Demo (Gate aus, Demo-Fahne an).
     Der Demo-Build setzt COMPASS_INSTANZ.demo=true von Haus aus. */
  const P = new URLSearchParams(location.search);
  if (P.get('demo') === '1') INST.demo = true;
  if (P.get('demo') === '0') INST.demo = false;
  if (INST.demo) INST.gate = { salt: '', hash: '', tage: 30 };

  /* ---- 2. Kontexte auf die vier Farbslots legen -------------------------- */
  /* Die vier Slots heißen im Code seit jeher va|vk|pr|fi. Das sind reine
     Platzhalter für Slot 1–4 (CSS-Farben, Tastenkürzel 1–4, localStorage).
     Was die Nutzerin sieht, kommt ausschließlich aus name/icon/farbe.        */
  const SLOTS = ['va', 'vk', 'pr', 'fi'];
  const STD_FARBE = { va: '#1a44ea', vk: '#89c527', pr: '#e8734a', fi: '#f0b429' };

  const roh = (INST.kontexte && INST.kontexte.length ? INST.kontexte : [
    { slot: 1, name: 'Arbeit', icon: '🏢', worte: [] }
  ]).slice(0, 4);

  INST.ctx = roh.map(function (k, i) {
    const slot = SLOTS[(k.slot ? k.slot - 1 : i)] || SLOTS[i] || 'fi';
    return {
      key: slot,
      name: k.name || 'Kontext ' + (i + 1),
      icon: k.icon || '•',
      farbe: k.farbe || STD_FARBE[slot],
      worte: (k.worte || []).filter(Boolean).map(String),
      jira: k.jira || '',
      trello: k.trello || ''
    };
  });
  INST.ctxKeys = INST.ctx.map(function (c) { return c.key; });

  /* Stichwort-Regexp je Kontext (aus worte gebaut, Sonderzeichen entschärft) */
  const escRe = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  INST.ktxWort = {};
  INST.ctx.forEach(function (c) {
    INST.ktxWort[c.key] = c.worte.length
      ? new RegExp(c.worte.map(escRe).join('|'), 'gi')
      : /$^/g;                       /* kein Stichwort → trifft nie */
  });
  /* Ticketnummern (Jira-Keys) erkennen — aus INST.jira.keys */
  const jk = (INST.jira.keys || []).filter(Boolean).map(function (s) { return escRe(String(s).toUpperCase()); });
  INST.ktxJira = jk.length ? new RegExp('\\b(?:' + jk.join('|') + ')-\\d+', 'g') : /$^/g;
  /* Welcher Kontext bekommt Jira-Treffer / welche Trello-Quelle gehört wohin */
  INST.jiraCtx = (INST.ctx.filter(function (c) { return c.jira; })[0] || {}).key || null;
  INST.ktxQuelle = {};
  INST.ctx.forEach(function (c) { if (c.trello) INST.ktxQuelle['trello-' + c.trello] = c.key; });

  /* ---- 3. Farben in die CSS-Variablen schreiben --------------------------- */
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return 'rgba(120,140,180,' + a + ')';
    const n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function farbenSetzen() {
    const r = document.documentElement.style;
    INST.ctx.forEach(function (c) { r.setProperty('--' + c.key, c.farbe); });
    if (INST.ctx[0]) { r.setProperty('--va', INST.ctx[0].farbe); r.setProperty('--g1', hexA(INST.ctx[0].farbe, .30)); }
    const zweite = INST.ctx[1] || INST.ctx[0];
    if (zweite) r.setProperty('--g2', hexA(zweite.farbe, .22));
  }
  if (document.documentElement) farbenSetzen();

  /* ---- 4. Konnektoren ---------------------------------------------------- */
  /* status: an      — in dieser Instanz eingerichtet und aktiv
             bereit  — im Produkt enthalten, muss nur verbunden werden
             arbeit  — wird gerade gebaut, Termin in `wann`
             geplant — auf der Roadmap, Reihenfolge nach Nachfrage           */
  const KONNEKTOREN = [
    { id: 'trello', icon: '📋', name: 'Trello', status: 'bereit',
      was: 'Karten in beide Richtungen: Listen erscheinen auf Mein Board, Ziehen schreibt nach Trello zurück (verschieben, archivieren, Fälligkeit setzen).' },
    { id: 'jira', icon: '🎫', name: 'Jira Cloud', status: 'bereit',
      was: 'Deine offenen Vorgänge landen im Board, ein Statuswechsel geht als Übergang zurück nach Jira. Neue Vorgänge legst du direkt aus dem Compass an.' },
    { id: 'coach', icon: '🤵', name: 'KI-Coach (Claude)', status: 'bereit',
      was: 'Ein Sparringspartner, der deine Board-Metriken kennt: was blockiert, was zu lange liegt, was heute das Eine ist.' },
    { id: 'team', icon: '✈️', name: 'Flight Levels · Team-Cockpit', status: 'bereit',
      was: 'Der Sprung von deinem persönlichen Fluss (FL1) auf Team, Koordination (FL2) und Strategie (FL3) — dieselbe Arbeit, eine Ebene höher.' },
    { id: 'export', icon: '⤓', name: 'Export / Import', status: 'bereit',
      was: 'Fortschritt, Board und Einstellungen als Datei sichern und auf einem anderen Rechner einspielen. Keine Cloud-Pflicht.' },
    { id: 'kalender', icon: '📅', name: 'Google Kalender', status: 'arbeit', wann: 'Q4 2026',
      was: 'Die Termine des Tages neben dem Einen — und ein ehrlicher Blick, ob der Kalender zu deinem Fokus passt.' },
    { id: 'ms365', icon: '📨', name: 'Microsoft 365 (Outlook, To Do)', status: 'arbeit', wann: 'Q4 2026',
      was: 'Aufgaben aus To Do und markierte Mails als Karten, ohne dass dein Postfach zur Aufgabenliste wird.' },
    { id: 'slack', icon: '💬', name: 'Slack', status: 'geplant',
      was: 'Gemerkte Nachrichten werden Karten; der Morgencheck fasst zusammen, was du wirklich lesen musst.' },
    { id: 'notion', icon: '🗒️', name: 'Notion', status: 'geplant',
      was: 'Datenbank-Einträge als Karten, Status schreibt der Compass zurück.' },
    { id: 'asana', icon: '✅', name: 'Asana', status: 'geplant',
      was: 'Aufgaben und Fälligkeiten in Mein Board, Abschluss zurück nach Asana.' },
    { id: 'linear', icon: '📐', name: 'Linear', status: 'geplant',
      was: 'Issues und Zyklen für Produktteams, gleiche Zwei-Wege-Logik wie bei Jira.' },
    { id: 'github', icon: '🐙', name: 'GitHub / GitLab', status: 'geplant',
      was: 'Zugewiesene Issues und offene Reviews — die stille Arbeit, die sonst in keinem Board steht.' },
    { id: 'zeit', icon: '⏱️', name: 'Toggl / Clockify', status: 'geplant',
      was: 'Echte Zeit gegen geschätzten Aufwand: woran der Tag wirklich vergangen ist.' },
    { id: 'miro', icon: '🧩', name: 'Miro / Confluence', status: 'geplant',
      was: 'Heute als Link-Karte geführt — das funktioniert, schreibt aber nichts zurück. Eine echte Anbindung steht auf der Karte.' }
  ];
  const K_LABEL = { an: ['✅', 'verbunden', 'grn'], bereit: ['🔌', 'enthalten', 'blu'], arbeit: ['🛠️', 'in Arbeit', 'amb'], geplant: ['🗺️', 'geplant', 'gry'] };

  function konnektorenListe() {
    const ueber = INST.konnektoren || {};
    return KONNEKTOREN.map(function (k) { return Object.assign({}, k, ueber[k.id] ? { status: ueber[k.id] } : {}); });
  }

  /* `esc` kommt aus dem Haupt-Skript; für den Fall der Fälle ein Rückfall. */
  const E = function (s) { return window.esc ? window.esc(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  function konnektorCard() {
    if (INST.module.konnektoren === false) return '';
    const list = konnektorenListe();
    const grp = function (s) { return list.filter(function (k) { return k.status === s; }); };
    const zeile = function (k) {
      const l = K_LABEL[k.status] || K_LABEL.geplant;
      return '<div class="item"><div class="ic">' + k.icon + '</div><div class="body">' +
        '<div class="t"><b>' + E(k.name) + '</b> <span class="tag ' + l[2] + '">' + l[0] + ' ' + l[1] + (k.wann ? ' · ' + E(k.wann) : '') + '</span></div>' +
        '<div class="m">' + E(k.was) + '</div></div></div>';
    };
    const aktiv = grp('an').concat(grp('bereit'));
    const kommt = grp('arbeit').concat(grp('geplant'));
    const mail = INST.kontaktMail || 'contract@vishnuartists.com';
    return '<div class="card s6 tone-none"><h3>🔌 Verbundene Werkzeuge <span class="cnt">' + aktiv.length + ' nutzbar · ' + kommt.length + ' auf der Karte</span></h3>' +
      '<div class="mini">Der Compass sammelt dort ein, wo deine Arbeit ohnehin liegt — er ersetzt kein Werkzeug. Was du ziehst, wird zurückgeschrieben; was nicht geht, sagt er dir ehrlich.</div>' +
      aktiv.map(zeile).join('') +
      '<div class="mini" style="margin-top:10px"><b>Was als Nächstes kommt</b> — die Reihenfolge bestimmen die Kundinnen und Kunden. Sag uns, was dir fehlt.</div>' +
      kommt.map(zeile).join('') +
      '<div class="chipbar">' +
      '<a class="btn" href="mailto:' + E(mail) + '?subject=' + encodeURIComponent('Flow Compass: Konnektor-Wunsch') + '">🔔 Konnektor wünschen</a>' +
      '<button class="btn w" onclick="compassSetup.oeffnen(3)">⚙️ Quellen einrichten</button>' +
      '</div></div>';
  }

  /* ---- 5. Einrichtungs-Assistent ----------------------------------------- */
  /* Sechs Schritte, jederzeit über ⚙️ im Kopf erreichbar. Schreibt nach
     localStorage.compassInstanz und lädt neu — kein Server nötig.           */
  const SCHRITTE = [
    { id: 'start', icon: '🪷', titel: 'Willkommen' },
    { id: 'person', icon: '👤', titel: 'Du' },
    { id: 'kontext', icon: '🎛️', titel: 'Deine Kontexte' },
    { id: 'quellen', icon: '🔌', titel: 'Deine Quellen' },
    { id: 'board', icon: '🧭', titel: 'Dein Board' },
    { id: 'fertig', icon: '🚀', titel: 'Fertig' }
  ];

  const compassSetup = {
    schritt: 0,
    entwurf: null,

    /* Erster Start: noch nie durchgelaufen und keine Demo.
       `eingerichtet: true` in instanz.js heisst: diese Instanz haben wir im
       Erstgespraech fertig konfiguriert und ausgeliefert (Routine
       docs/compass-onboarding.md, Schritt 4). Dann darf der Assistent nicht
       von selbst aufgehen — die Kundin soll ihr Cockpit sehen, nicht einen
       Fragebogen, den wir schon beantwortet haben. Ueber das Zahnrad im Kopf
       ist er weiterhin erreichbar, und Aendern bleibt jederzeit moeglich.
       Gefunden am 31.08.2026 bei der ersten Kundeninstanz (VA-13532): ohne
       den Schalter begruesst jede ausgelieferte Instanz ihre Kundschaft mit
       dem Einrichtungs-Assistenten, weil compassSetupFertig im Browser der
       Kundin natuerlich fehlt. */
    noetig: function () {
      if (INST.demo) return false;
      if (INST.eingerichtet) return false;
      return localStorage.getItem('compassSetupFertig') !== '1';
    },

    oeffnen: function (schritt) {
      this.entwurf = {
        name: INST.name || '', mail: INST.mail || '', api: INST.api || '',
        kontexte: (INST.kontexte && INST.kontexte.length ? INST.kontexte : INST.ctx).map(function (c, i) {
          return { slot: i + 1, name: c.name || '', icon: c.icon || '', farbe: c.farbe || STD_FARBE[SLOTS[i]], worte: (c.worte || []).slice(), jira: c.jira || '', trello: c.trello || '' };
        }),
        trello: { privat: { url: ((INST.trello.privat || {}).url) || '' }, arbeit: { url: ((INST.trello.arbeit || {}).url) || '' } },
        jira: { browse: INST.jira.browse || '', board: INST.jira.board || '', keys: (INST.jira.keys || []).slice() },
        team: { an: !!INST.team.an, url: INST.team.url || '' },
        board: { wip: INST.board.wip || 3 }
      };
      this.schritt = typeof schritt === 'number' ? schritt : 0;
      this.malen();
    },

    schliessen: function () {
      const el = document.getElementById('setupOv');
      if (el) el.classList.remove('on');
    },

    weiter: function (n) { this.schritt = Math.max(0, Math.min(SCHRITTE.length - 1, this.schritt + n)); this.malen(); },

    /* Feldwerte einsammeln, bevor der Schritt wechselt */
    lesen: function () {
      const v = function (id) { const e = document.getElementById(id); return e ? e.value.trim() : undefined; };
      const d = this.entwurf;
      if (v('suName') !== undefined) { d.name = v('suName'); d.mail = v('suMail'); d.api = (v('suApi') || '').replace(/\/$/, ''); }
      if (v('suK0Name') !== undefined) {
        for (let i = 0; i < 4; i++) {
          const k = d.kontexte[i] || (d.kontexte[i] = { slot: i + 1, jira: '', trello: '' });
          k.slot = i + 1;
          k.name = v('suK' + i + 'Name') || '';
          k.icon = v('suK' + i + 'Icon') || '•';
          k.farbe = v('suK' + i + 'Farbe') || STD_FARBE[SLOTS[i]];
          k.worte = (v('suK' + i + 'Worte') || '').split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
        }
        d.kontexte = d.kontexte.filter(function (k) { return k && k.name; });
      }
      if (v('suTrelloPrivat') !== undefined) {
        d.trello = { privat: { label: 'Mein privates Board', url: v('suTrelloPrivat') }, arbeit: { label: 'Team-Board', url: v('suTrelloArbeit') } };
        d.jira = { browse: v('suJiraBrowse'), board: v('suJiraBoard'), keys: (v('suJiraKeys') || '').split(/[,;\s]+/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean) };
        const t = document.getElementById('suTeamAn');
        d.team = { an: !!(t && t.checked), url: v('suTeamUrl') || '' };
        /* Kontext 1 bekommt die Team-Quellen, sofern nichts anderes gesetzt ist */
        if (d.kontexte[0]) {
          if (!d.kontexte[0].trello && d.trello.arbeit.url) d.kontexte[0].trello = 'arbeit';
          if (!d.kontexte[0].jira && d.jira.browse) d.kontexte[0].jira = 'ops';
        }
        if (d.kontexte[2] && !d.kontexte[2].trello && d.trello.privat.url) d.kontexte[2].trello = 'privat';
      }
      if (v('suWip') !== undefined) d.board = { wip: Math.max(1, Math.min(19, parseInt(v('suWip'), 10) || 3)) };
    },

    speichern: function () {
      this.lesen();
      const d = this.entwurf;
      d.kontexte.forEach(function (k, i) { k.slot = i + 1; });
      let alt = {};
      try { alt = JSON.parse(localStorage.getItem('compassInstanz') || '{}'); } catch (e) { alt = {}; }
      const neu = Object.assign(alt, {
        name: d.name, mail: d.mail, api: d.api, kontexte: d.kontexte,
        trello: d.trello, jira: d.jira,
        team: Object.assign({}, INST.team, d.team),
        board: Object.assign({}, INST.board, { wip: d.board.wip })
      });
      localStorage.setItem('compassInstanz', JSON.stringify(neu));
      localStorage.setItem('compassSetupFertig', '1');
      location.reload();
    },

    zuruecksetzen: function () {
      if (!confirm('Einrichtung zurücksetzen? Karten, XP und Antworten bleiben erhalten — nur Name, Kontexte und Quellen werden neu abgefragt.')) return;
      localStorage.removeItem('compassInstanz');
      localStorage.removeItem('compassSetupFertig');
      location.reload();
    },

    koerper: function () {
      const d = this.entwurf, s = SCHRITTE[this.schritt].id;
      if (s === 'start') return '' +
        '<p class="sub">Der Compass beantwortet jeden Morgen eine Frage: <b>Was ist jetzt dran?</b> Er zieht die Arbeit aus deinen ' +
        'Werkzeugen zusammen, macht sie sichtbar und begrenzt sie — Personal Kanban nach Jim Benson, kein weiteres To-do-Grab.</p>' +
        '<p class="sub">Die nächsten vier Schritte dauern etwa fünf Minuten. Alles ist danach änderbar (⚙️ oben im Kopf). ' +
        'Deine Antworten bleiben in diesem Browser; ohne Server verlässt nichts deinen Rechner.</p>' +
        '<ul class="sul"><li><b>Du</b> — Name und wohin Erinnerungen gehen</li>' +
        '<li><b>Kontexte</b> — die Lebensbereiche, zwischen denen du umschaltest</li>' +
        '<li><b>Quellen</b> — Trello, Jira, Team-Cockpit</li><li><b>Board</b> — dein WIP-Limit</li></ul>';

      if (s === 'person') return '' +
        '<p class="sub">Der Compass spricht dich an — dafür braucht er einen Namen. Die E-Mail nutzen die „schick mir …“-Knöpfe; sie geht an niemanden sonst.</p>' +
        '<label class="sf"><span>Wie sollen wir dich nennen?</span><input id="suName" value="' + E(d.name) + '" placeholder="Alex"></label>' +
        '<label class="sf"><span>Deine E-Mail</span><input id="suMail" value="' + E(d.mail) + '" placeholder="du@firma.de"></label>' +
        '<label class="sf"><span>Server-Adresse <em>(optional)</em></span><input id="suApi" value="' + E(d.api) + '" placeholder="leer lassen = Solo-Modus"></label>' +
        '<p class="shint">Ohne Server läuft alles im Browser: Board, Rituale, Fortschritt. Mit Server kommen Trello, Jira und der Coach dazu — die Adresse bekommst du von uns.</p>';

      if (s === 'kontext') {
        const rows = [0, 1, 2, 3].map(function (i) {
          const k = d.kontexte[i] || { name: '', icon: '', farbe: STD_FARBE[SLOTS[i]], worte: [] };
          return '<div class="skx">' +
            '<input id="suK' + i + 'Icon" class="sicon" value="' + E(k.icon || '') + '" placeholder="🏢" title="Emoji">' +
            '<input id="suK' + i + 'Name" value="' + E(k.name || '') + '" placeholder="' + (i === 0 ? 'Arbeit' : 'leer = Platz bleibt frei') + '">' +
            '<input id="suK' + i + 'Farbe" class="sfarbe" type="color" value="' + E(k.farbe || STD_FARBE[SLOTS[i]]) + '" title="Akzentfarbe">' +
            '<input id="suK' + i + 'Worte" class="sworte" value="' + E((k.worte || []).join(', ')) + '" placeholder="Stichwörter, mit Komma">' +
            '</div>';
        }).join('');
        return '<p class="sub">Bis zu vier Kontexte — deine Reiter oben (Tasten 1–4). Der Compass sortiert Karten und Zeilen anhand der ' +
          '<b>Stichwörter</b> automatisch ein; was zu keinem passt, bleibt überall sichtbar (er versteckt nie Arbeit).</p>' +
          '<div class="skxh"><span></span><span>Name</span><span>Farbe</span><span>Stichwörter</span></div>' + rows +
          '<p class="shint">Beispiel Beratung: <em>Kunden</em> (angebot, workshop, rechnung…) · <em>Akquise</em> (linkedin, netzwerk, messe…) · ' +
          '<em>Eigenes</em> (website, produkt, lernen…) · <em>Privat</em>.</p>';
      }

      if (s === 'quellen') return '' +
        '<p class="sub">Was hier steht, holt der Compass automatisch auf Mein Board — und schreibt Statuswechsel zurück. ' +
        'Leer lassen ist völlig in Ordnung; eigene Karten kannst du immer anlegen.</p>' +
        '<label class="sf"><span>Trello · privates Board (URL)</span><input id="suTrelloPrivat" value="' + E(d.trello.privat.url) + '" placeholder="https://trello.com/b/…"></label>' +
        '<label class="sf"><span>Trello · Team-Board (URL)</span><input id="suTrelloArbeit" value="' + E(d.trello.arbeit.url) + '" placeholder="https://trello.com/b/…"></label>' +
        '<label class="sf"><span>Jira · Basis-Adresse</span><input id="suJiraBrowse" value="' + E(d.jira.browse) + '" placeholder="https://firma.atlassian.net/browse/"></label>' +
        '<label class="sf"><span>Jira · dein Board (URL)</span><input id="suJiraBoard" value="' + E(d.jira.board) + '" placeholder="https://firma.atlassian.net/…rapidView=12"></label>' +
        '<label class="sf"><span>Jira · Projektkürzel</span><input id="suJiraKeys" value="' + E((d.jira.keys || []).join(', ')) + '" placeholder="OPS, PROJ"></label>' +
        '<label class="sf sfc"><input type="checkbox" id="suTeamAn"' + (d.team.an ? ' checked' : '') + '><span>✈️ Team-Cockpit (Flight Levels) anbinden</span></label>' +
        '<label class="sf"><span>Adresse des Team-Cockpits</span><input id="suTeamUrl" value="' + E(d.team.url) + '" placeholder="https://…/va/"></label>' +
        '<p class="shint">Zugangs-Token trägst du hier <b>nicht</b> ein — die liegen im Server, den wir für dich einrichten. Der Browser sieht sie nie.</p>';

      if (s === 'board') return '' +
        '<p class="sub">Ein Personal Kanban lebt von einer Regel: <b>Stoppe das Anfangen, starte das Beenden.</b> ' +
        'Das WIP-Limit ist die Zahl der Karten, die gleichzeitig in „In Arbeit“ liegen dürfen. Benson und Barry empfehlen drei.</p>' +
        '<label class="sf"><span>WIP-Limit für „In Arbeit“</span><input id="suWip" type="number" min="1" max="19" value="' + E(d.board.wip || 3) + '"></label>' +
        '<p class="shint">Zu hoch gesetzt merkst du daran, dass nichts fertig wird. Der Compass sagt dir, wenn du darüber liegst — hindern wird er dich nicht.</p>';

      const quellen = [
        d.trello.privat.url ? 'Trello privat' : '',
        d.trello.arbeit.url ? 'Trello Team' : '',
        d.jira.browse ? 'Jira' : '',
        d.team.an ? 'Team-Cockpit' : ''
      ].filter(Boolean).join(' · ');
      return '<p class="sub">Das war’s. Der Compass richtet sich jetzt ein und lädt neu.</p>' +
        '<ul class="sul">' +
        '<li><b>' + E(d.name || 'Du') + '</b> · ' + E(d.mail || 'ohne E-Mail') + '</li>' +
        '<li>' + d.kontexte.length + ' Kontext' + (d.kontexte.length === 1 ? '' : 'e') + ': ' + E(d.kontexte.map(function (k) { return (k.icon || '') + ' ' + k.name; }).join(' · ')) + '</li>' +
        '<li>Quellen: ' + E(quellen || 'noch keine — eigene Karten reichen für den Anfang') + '</li>' +
        '<li>WIP-Limit: ' + E(d.board.wip || 3) + '</li></ul>' +
        '<p class="shint">Danach zeigt dir der Compass den Morgencheck. Fünf Minuten, jeden Tag — mehr braucht es nicht.</p>';
    },

    malen: function () {
      let ov = document.getElementById('setupOv');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'setupOv'; ov.className = 'ov';
        document.body.appendChild(ov);
      }
      const letzter = this.schritt === SCHRITTE.length - 1;
      ov.innerHTML = '<div class="setup">' +
        '<div class="suh">' +
        '<div class="sut">' + SCHRITTE[this.schritt].icon + ' ' + E(SCHRITTE[this.schritt].titel) + '</div>' +
        '<div class="sup">' + SCHRITTE.map(function (s, i) {
          return '<span class="' + (i === compassSetup.schritt ? 'on' : (i < compassSetup.schritt ? 'ok' : '')) + '"></span>';
        }).join('') + '</div>' +
        (this.schritt === 0 ? '' : '<button class="sux" onclick="compassSetup.schliessen()" title="Später">✕</button>') +
        '</div>' +
        '<div class="subody">' + this.koerper() + '</div>' +
        '<div class="suf">' +
        (this.schritt > 0 ? '<button class="btn" onclick="compassSetup.lesen();compassSetup.weiter(-1)">← Zurück</button>' : '<span></span>') +
        '<span style="flex:1"></span>' +
        (letzter
          ? '<button class="btn a" onclick="compassSetup.speichern()">🚀 Compass starten</button>'
          : '<button class="btn a" onclick="compassSetup.lesen();compassSetup.weiter(1)">Weiter →</button>') +
        '</div></div>';
      ov.classList.add('on');
      const f = ov.querySelector('input');
      if (f) setTimeout(function () { f.focus(); }, 60);
    }
  };

  /* ---- 6. KI-Coach in der Demo: aufgezeichneter Beispiel-Dialog ----------- */
  /* Die Demo läuft bewusst ohne Server und ohne API-Budget (VA-13505). Statt
     „Der Coach ist offline“ beantwortet der Coach die vier Schnell-Fragen mit
     einem vorbereiteten Dialog, der zum Beispiel-Board (demo/dashboard-data.js)
     passt; freie Fragen bekommen eine ehrliche Demo-Antwort. Sobald ein echter
     Server konfiguriert ist (instanz.api oder ?john=…), tritt der Block von
     selbst zurück — der echte Coach schlägt jede Aufzeichnung. */
  (function () {
    if (!INST.demo) return;

    /* Die Texte sind auf das Beispiel-Board geschrieben (Workshop Kunde Nord,
       Angebot „Team-Kickoff“, PROJ-91, OPS-142, Blogartikel, zwei Rechnungen).
       Ändert sich demo/dashboard-data.js, diese Antworten mitziehen. */
    const A = {
      heute:
        'Kurz und priorisiert — so, wie dein Board gerade steht:\n\n' +
        '1. 🎯 Workshop-Konzept Kunde Nord — dein Eines für heute. Zwei Stunden am Stück, bevor der Tag zerfasert. Perfekt wird es beim Kunden, nicht am Schreibtisch.\n' +
        '2. 📞 Angebot „Team-Kickoff“ nachfassen — liegt seit Montag. Ein Anruf: gewinnen oder bewusst schließen, beides ist besser als offen halten.\n' +
        '3. 🔓 PROJ-91 anstupsen — die Zugänge blockieren seit 9 Tagen. Das ist keine Arbeit, das ist eine Zwei-Zeilen-Mail.\n\n' +
        'Alles andere hat bis morgen Zeit. Dein WIP-Limit steht bei 3 — halt es ein.',
      pipeline:
        'Drei Stellen, an denen es gerade hakt:\n\n' +
        '⏳ OPS-142 (Onboarding-Strecke) liegt seit 6 Tagen in Arbeit und ist Freitag fällig — für die Größe zu lange. Heute 90 Minuten blocken oder den Umfang ehrlich kürzen.\n' +
        '🔓 PROJ-91 (Zugänge Kunden-Board) wartet seit 9 Tagen auf die IT der Kundin. Nicht weiter warten: kurze Mail mit Terminvorschlag, Kopie an deine Ansprechpartnerin.\n' +
        '🧾 Zwei Rechnungen sind über 30 Tage offen. Freundlich nachfassen — heute, nicht „diese Woche“.\n\n' +
        'Der nächste Schritt ist der kleinste, der Bewegung erzeugt: die Mail zu PROJ-91 zuerst, die kostet dich fünf Minuten.',
      sparring:
        'Gern. Lass uns die Entscheidung sauber auseinandernehmen, bevor du sie triffst:\n\n' +
        '1. Was genau entscheidest du — und was entscheidest du damit ausdrücklich nicht?\n' +
        '2. Was passiert, wenn du zwei Wochen gar nichts entscheidest? Oft die ehrlichste Frage.\n' +
        '3. Ist die Entscheidung umkehrbar? Umkehrbare Entscheidungen darfst du schnell treffen.\n\n' +
        'Auf deinem Board sehe ich einen Kandidaten: die Verlängerung bei Kunde Nord ab Quartalswechsel. Worum geht es bei dir?',
      sparring2:
        'Gut, dann wende die drei Fragen darauf an: Schreib in einer Zeile auf, was du entscheidest — fällt dir das schwer, sind es in Wahrheit zwei Entscheidungen. ' +
        'Prüfe, ob sie umkehrbar ist: Wenn ja, entscheide heute und schau in zwei Wochen ehrlich hin. Wenn nein, hol dir genau die eine Information, die noch fehlt — ' +
        'und leg sie im Compass als Rückfrage mit Termin an, damit sie nicht weiter im Kopf kreist.\n\n' +
        '(In der Demo bin ich ein aufgezeichneter Dialog — in deiner Instanz gehe ich hier auf deinen konkreten Fall ein.)',
      ehrlich:
        'Ehrlich? Zwei Dinge:\n\n' +
        '✍️ Der Blogartikel „WIP-Limits ohne Drama“ wartet nur noch auf den Schluss — und ist seit Tagen „fast fertig“. Fast fertig ist die teuerste Sorte unfertig: eine Stunde, dann ist er draußen.\n' +
        '📞 Das Angebot „Team-Kickoff“ fasst du seit Montag nicht nach. Das sieht nach Aufschieben aus Sorge vor einem Nein aus — aber ein Nein ist besser als ein offenes Vielleicht auf deinem Board.\n\n' +
        'Beides zusammen kostet dich mehr Aufmerksamkeit, als die Erledigung kosten würde. Stoppe das Anfangen, starte das Beenden.',
      gruss:
        'Hallo' + (INST.name ? ' ' + INST.name : '') + '! Ich bin dein Coach — ich sehe dein Board, deine Kennzahlen und deine offenen Entscheidungen. ' +
        'Tipp auf einen der Vorschläge unter dem Chat oder frag mich, was heute ansteht.',
      frei:
        'Gute Frage — und genau hier bin ich ehrlich mit dir: In dieser Demo bin ich ein aufgezeichneter Dialog, kein echtes Sprachmodell. ' +
        'Auf die vier Fragen unter dem Chat habe ich Antworten, die zum Beispiel-Board passen.\n\n' +
        'In deiner eigenen Instanz antwortet an dieser Stelle Claude live — mit Blick auf dein Board, deinen Kalender und deine Kennzahlen. ' +
        'Deine Instanz bekommst du über „🚀 Einrichten lassen“ oben im Demo-Band.',
      summary:
        'Dein Hebel heute ist das Workshop-Konzept für Kunde Nord — zwei Stunden am Stück, bevor der Tag zerfasert. ' +
        'Danach das Angebot „Team-Kickoff“ anrufen und die blockierten Zugänge (PROJ-91) anstupsen: Beides wartet länger, als ihm guttut.'
    };

    /* Reihenfolge zählt: „Entscheidung von heute“ soll Sparring treffen, nicht Heute. */
    const REGELN = [
      ['sparring', /sparring|entscheidung|durchdenken|dilemma|abw[äa]gen/],
      ['ehrlich', /ehrlich|verschlepp|aufschieb|prokrast|vermeid/],
      ['pipeline', /pipeline|[üu]berf[äa]llig|n[äa]chste[rn]? schritt|blockiert|h[äa]ngt|liegen ?geblieben/],
      ['heute', /heute|was steht|ansteh|zuerst|anfangen|prioris|fokus|wichtig/]
    ];
    let folge = '';
    function antwort(txt) {
      const t = String(txt || '').toLowerCase();
      if (/^\s*(hi|hallo|hey|moin|servus|guten\s+(morgen|tag|abend))[\s!,.?]*$/.test(t)) { folge = ''; return A.gruss; }
      for (let i = 0; i < REGELN.length; i++) {
        if (REGELN[i][1].test(t)) { folge = REGELN[i][0] === 'sparring' ? 'sparring' : ''; return A[REGELN[i][0]]; }
      }
      if (folge === 'sparring') { folge = ''; return A.sparring2; }
      return A.frei;
    }

    const antwortJson = function (o) {
      return new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    function coachStart() {
      /* Läuft NACH dem Haupt-Skript (dessen Solo-Modus-Wrapper lehnt /api/ ab):
         dieser Wrapper liegt darüber und fängt nur die Coach-Wege ab. Erst hier
         prüfen, ob doch ein echter Server konfiguriert ist — ?john=… wird vom
         Haupt-Skript beim Laden in localStorage übernommen. */
      let api = '';
      try { api = localStorage.getItem('compassJohnApi') || ''; } catch (e) { }
      if (api || INST.api) return;

      const echt = window.fetch;
      window.fetch = function (u, opts) {
        const p = String((u && u.url) || u || '');
        if (/\/api\/john\/summary(\?|$)/.test(p)) return Promise.resolve(antwortJson({ text: A.summary, model: 'Demo-Dialog' }));
        if (/\/api\/john(\?|$)/.test(p)) {
          let frage = '';
          try {
            const b = JSON.parse((opts || {}).body || '{}');
            const m = (b.messages || []).filter(function (x) { return x.role === 'user'; });
            frage = (m[m.length - 1] || {}).content || '';
          } catch (e) { }
          const text = antwort(frage);
          return new Promise(function (res) { setTimeout(function () { res(antwortJson({ text: text, model: 'Demo-Dialog' })); }, 700 + Math.random() * 700); });
        }
        return echt.apply(window, arguments);
      };

      /* Statuszeile: kein „offline“, sondern die Wahrheit über die Demo.
         Ersetzt die globale Funktion aus dem Haupt-Skript — johnToggle() ruft
         sie bei jedem Öffnen über den globalen Namen auf. */
      window.johnStatus = async function () {
        const st = document.getElementById('johnStat'), fab = document.getElementById('johnFab');
        if (st) { st.textContent = 'Demo · aufgezeichneter Beispiel-Dialog — in deiner Instanz antwortet hier Claude live mit deinen Daten.'; st.classList.remove('bad'); }
        if (fab) fab.className = 'on';
      };
      window.johnStatus();

      /* Die Management-Summary ist beim Laden evtl. schon auf „offline“
         gelaufen — einmal frisch holen, jetzt antwortet der Demo-Dialog. */
      if (typeof window.summaryHolen === 'function') { try { window.summaryHolen(true); } catch (e) { } }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', coachStart);
    else coachStart();
  })();

  /* ---- 7. Nach außen geben ---------------------------------------------- */
  window.INST = INST;
  window.compassSetup = compassSetup;
  window.KONNEKTOREN = KONNEKTOREN;
  window.konnektorCard = konnektorCard;
  window.compassFarbenSetzen = farbenSetzen;
})();
