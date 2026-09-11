/* ============================================================================
   landkarte-ansicht.js — die Sternenkarte auf der Brücke (11.09.2026)

   Bene: „Wie würdest du Nordsterne, Mini-Nordsterne, Ziele, Initiativen und Projekte,
   Verantwortliche/Involvierte und eine Landkarte dahin skizzieren … bau es in meine
   Brücke.“ Diese Datei ist nur die ANSICHT. Die Inhalte stehen je Person in
   landkarte.js (window.LANDKARTE) neben portal.js an der Wurzel der Subdomain — sie
   sind persönlich, deshalb nie im Repo und nie in der Demo. Fehlt landkarte.js,
   zeichnet diese Datei nichts: keine Beispielsterne, keine Platzhalter.

   Aufbau (Schema ausführlich in produkt/portal/landkarte.example.js):
     nordstern            der eine Satz, auf den alles zeigt
     sterne[]             Mini-Nordsterne (Lebensbereiche), je mit
       ziele[]              messbar und mit Frist, je mit
         initiativen[]        wer verantwortet, wer ist beteiligt, je mit
           projekte[]           wo es konkret passiert (Repo, Seite, Board), nächster Schritt
     route[]              die Landkarte dahin: Etappen mit Meilensteinen
     menschen[]           wer woran hängt (Filter „Was an … hängt“)
     spannungen[]         wo sich die Sterne reiben, und die Regel dafür

   Bedienung: Stern anklicken (oder Taste 1–9 bei gedrückter Umschalttaste), Mensch
   anklicken filtert, #stern-<id> in der Adresse springt direkt hin. Das Holodeck und
   andere Seiten können dieselbe Datei lesen: window.LANDKARTE nach
   <script src="/landkarte.js">. API: window.STERNENKARTE.zeige('<stern-id>').
   ============================================================================ */
(function () {
  var L = window.LANDKARTE;
  var ziel = document.getElementById('sternenkarte');
  if (!ziel) return;
  if (!L || !L.nordstern || !Array.isArray(L.sterne) || !L.sterne.length) { ziel.hidden = true; return; }

  var SPR = function () { return document.documentElement.lang === 'en' ? 'en' : 'de'; };
  var T = {
    de: { kick: 'Sternenkarte', stand: 'Stand', woran: 'Woran ich es merke', ziele: 'Ziele',
          verantw: 'verantwortet', beteiligt: 'mit', naechster: 'Nächster Schritt', route: 'Die Route dahin',
          menschen: 'Wer an Bord ist', reibung: 'Wo sich die Sterne reiben', regel: 'Regel',
          jetzt: 'Jetzt auf Kurs', alle: 'Alle Sterne', anHaengt: 'Was an {n} hängt', nichts: 'Nichts eingetragen.',
          bis: 'bis', quelle: 'Quelle', prinzipien: 'Leitplanken', nav: 'Sternenkarte', offen: 'öffnen',
          status: { laeuft: 'läuft', offen: 'offen', wackelt: 'wackelt', steht: 'steht', erreicht: 'erreicht', idee: 'Idee' } },
    en: { kick: 'Star map', stand: 'as of', woran: 'How I notice it', ziele: 'Goals',
          verantw: 'owns', beteiligt: 'with', naechster: 'Next step', route: 'The route there',
          menschen: 'Who is on board', reibung: 'Where the stars pull against each other', regel: 'Rule',
          jetzt: 'On course now', alle: 'All stars', anHaengt: 'What depends on {n}', nichts: 'Nothing entered.',
          bis: 'by', quelle: 'source', prinzipien: 'Guard rails', nav: 'Star map', offen: 'open',
          status: { laeuft: 'running', offen: 'open', wackelt: 'shaky', steht: 'stuck', erreicht: 'reached', idee: 'idea' } }
  };
  /* Farben aus den Tokens der Brücke (portal.html) plus drei eigene, hell und dunkel. */
  var FARBE = { gruen: 'var(--green-d)', violett: 'var(--violet)', bernstein: 'var(--amber-d)',
                himmel: 'var(--sk-himmel)', rose: 'var(--sk-rose)', tuerkis: 'var(--sk-tuerkis)' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* Ein Feld darf Text sein oder {de,en}. */
  function tx(v) { if (v && typeof v === 'object' && !Array.isArray(v)) return v[SPR()] || v.de || ''; return v == null ? '' : v; }
  function farbe(s) { return FARBE[s && s.farbe] || 'var(--green-d)'; }
  function statusPill(st) {
    if (!st) return '';
    var t = T[SPR()].status[st] || st;
    return '<span class="sk-st sk-' + esc(st) + '">' + esc(t) + '</span>';
  }
  function liste(a) { return Array.isArray(a) ? a : []; }
  function datum(d) {
    if (!d) return '';
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d);
    if (!m) return esc(d);
    return m[3] ? (m[3] + '.' + m[2] + '.' + m[1]) : (m[2] + '/' + m[1]);
  }
  function link(u, inhalt) {
    if (!u) return inhalt;
    var ext = !/^[.#\/]/.test(u);
    return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + inhalt + '</a>';
  }

  /* ---------- Stil: einmal einhängen, nutzt die Tokens der Brücke ------------------ */
  var css = document.createElement('style');
  css.textContent = [
    ':root{--sk-himmel:#2f6fb0;--sk-rose:#b04a6e;--sk-tuerkis:#1f8a80;--sk-nacht:#141a2e;--sk-nacht2:#1f2745}',
    'html[data-theme="dark"]{--sk-himmel:#8ec3ff;--sk-rose:#f19ab8;--sk-tuerkis:#6fd8cc}',
    '.sk{margin-top:44px;padding-top:26px;border-top:1px solid var(--line)}',
    '.sk-kopf{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}',
    '.sk-kopf .bt{flex:1;min-width:260px}',
    '.sk-kopf h2{font-size:clamp(28px,3.6vw,42px);margin:2px 0 6px}',
    '.sk-kopf .sub{margin:0;color:var(--sub);font-size:15px;max-width:70ch}',
    '.sk-prinz{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}',
    '.sk-prinz span{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:3px 11px;font-size:12.5px;color:var(--ink)}',
    '.sk-himmel{margin-top:18px;border-radius:var(--radius);overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,var(--sk-nacht2),var(--sk-nacht) 70%);box-shadow:var(--shadow)}',
    '.sk-himmel svg{display:block;width:100%;height:auto}',
    '.sk-himmel .sk-knopf{cursor:pointer}',
    '.sk-himmel .sk-knopf:focus{outline:none}',
    '.sk-himmel .sk-knopf:focus .sk-ring,.sk-himmel .sk-knopf:hover .sk-ring{stroke-opacity:.9}',
    '.sk-wahl{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}',
    '.sk-wahl button{font:inherit;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}',
    '.sk-wahl button[aria-pressed="true"]{border-color:var(--sk-f,var(--green-d));box-shadow:inset 0 0 0 1.5px var(--sk-f,var(--green-d))}',
    '.sk-wahl button .dot{width:9px;height:9px;border-radius:50%;background:var(--sk-f,var(--green-d));display:inline-block}',
    '.sk-jetzt{margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 18px;box-shadow:var(--shadow)}',
    '.sk-jetzt h4,.sk-block h4{margin:0 0 8px;font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--sub);font-family:Inter}',
    '.sk-jetzt ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;font-size:14px}',
    '.sk-jetzt li b{font-weight:700}',
    '.sk-detail{margin-top:18px}',
    '.sk-dk{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;border-left:4px solid var(--sk-f,var(--green-d));padding:4px 0 4px 14px}',
    '.sk-dk .ic{font-size:30px;line-height:1}',
    '.sk-dk h3{font-size:clamp(24px,2.8vw,32px);margin:0 0 4px}',
    '.sk-dk p{margin:0;color:var(--sub);max-width:72ch}',
    '.sk-merk{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}',
    '.sk-merk span{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:13px}',
    '.sk-merk span i{font-style:normal;color:var(--sub);font-size:11.5px;display:block}',
    '.sk-ziele{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:16px}',
    '.sk-ziel{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px 14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}',
    '.sk-ziel h5{margin:0;font-size:15.5px;font-weight:750;line-height:1.35}',
    '.sk-ziel .mess{font-size:12.5px;color:var(--sub)}',
    '.sk-ini{border-top:1px dashed var(--line);padding-top:8px}',
    '.sk-ini .it{font-size:13.5px;font-weight:650}',
    '.sk-ini .wer{font-size:12px;color:var(--sub);margin-top:2px}',
    '.sk-ini .wer b{color:var(--ink);font-weight:650}',
    '.sk-ini ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:3px}',
    '.sk-ini li{font-size:13px;display:grid;grid-template-columns:14px 1fr;gap:4px;align-items:baseline;line-height:1.45}',
    '.sk-ini li .pf{color:var(--sub)}',
    '.sk-ini li a{color:var(--green-d);text-decoration:none;font-weight:600}',
    '.sk-ini li a:hover{text-decoration:underline}',
    '.sk-ini li .nx{color:var(--sub);font-size:12px;margin-top:2px}',
    '.sk-st{font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;border-radius:999px;padding:1px 8px;border:1px solid var(--line);color:var(--sub);white-space:nowrap}',
    '.sk-laeuft{color:var(--green-d);border-color:var(--green-soft);background:var(--green-soft)}',
    '.sk-wackelt{color:var(--amber-d);border-color:var(--amber-soft);background:var(--amber-soft)}',
    '.sk-steht{color:#fff;background:#b3452f;border-color:#b3452f}',
    '.sk-erreicht{color:var(--violet);border-color:var(--violet-soft);background:var(--violet-soft)}',
    '.sk-idee{border-style:dashed}',
    '.sk-block{margin-top:26px}',
    '.sk-route{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;position:relative}',
    '.sk-etappe{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow)}',
    '.sk-etappe .et{font-family:"Instrument Serif",Georgia,serif;font-size:22px;line-height:1.1}',
    '.sk-etappe .es{font-size:12.5px;color:var(--sub);margin:4px 0 8px}',
    '.sk-etappe ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}',
    '.sk-etappe li{font-size:13px;display:flex;gap:7px;align-items:baseline}',
    '.sk-etappe li .dot{width:8px;height:8px;border-radius:50%;flex:none;transform:translateY(-1px)}',
    '.sk-leute{display:flex;flex-wrap:wrap;gap:8px}',
    '.sk-leute button{font:inherit;text-align:left;background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:7px 12px;cursor:pointer;color:var(--ink);font-size:13px;max-width:260px}',
    '.sk-leute button b{display:block;font-size:13.5px}',
    '.sk-leute button span{color:var(--sub);font-size:12px}',
    '.sk-leute button[aria-pressed="true"]{border-color:var(--green-d);background:var(--green-soft)}',
    '.sk-reib{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}',
    '.sk-reib div{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13.5px}',
    '.sk-reib div i{display:block;font-style:normal;color:var(--sub);font-size:12px;margin-top:6px}',
    '.sk-leer{color:var(--sub);font-size:13.5px}',
    '@media(max-width:640px){.sk-himmel text.lbl{display:none}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- Zustand ----------------------------------------------------------------- */
  var WAHL = null, PERSON = null;
  (function () { var m = /#stern-([\w-]+)/.exec(location.hash); if (m) WAHL = m[1]; })();
  if (!WAHL || !L.sterne.some(function (s) { return s.id === WAHL; })) WAHL = L.sterne[0].id;

  /* ---------- Der Himmel: Nordstern oben, die Mini-Nordsterne im Bogen darunter -------- */
  function sternPfad(cx, cy, r, zacken, innen) {
    var p = [], n = zacken * 2;
    for (var i = 0; i < n; i++) {
      var w = Math.PI / zacken * i - Math.PI / 2, rr = i % 2 ? r * innen : r;
      p.push((cx + Math.cos(w) * rr).toFixed(1) + ',' + (cy + Math.sin(w) * rr).toFixed(1));
    }
    return 'M' + p.join('L') + 'Z';
  }
  function himmel() {
    var W = 1000, H = 400, n = L.sterne.length, s = '';
    var nx = 500, ny = 78;
    /* Hintergrundsterne — fest gesät, damit das Bild beim Neuzeichnen nicht flackert. */
    var seed = 7;
    function zufall() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 70; i++) {
      s += '<circle cx="' + (zufall() * W).toFixed(0) + '" cy="' + (zufall() * H).toFixed(0) + '" r="' +
           (zufall() * 1.4 + .3).toFixed(1) + '" fill="#fff" opacity="' + (zufall() * .5 + .15).toFixed(2) + '"/>';
    }
    var pos = L.sterne.map(function (st, k) {
      var t = n === 1 ? .5 : k / (n - 1);
      return { x: 105 + t * 790, y: 285 - Math.sin(Math.PI * t) * 95 };
    });
    /* Beschriftung in höchstens zwei Zeilen: bei sechs Sternen bleiben ~150 px je Stern,
       eine Zeile „Gesund & voller Energie“ liefe in den Nachbarn. */
    function zeilen(text) {
      var w = String(text).split(' '), a = '', b = '';
      w.forEach(function (x) { if (!b && (a + ' ' + x).trim().length <= 14) a = (a + ' ' + x).trim(); else b = (b + ' ' + x).trim(); });
      return b ? [a, b] : [a];
    }
    /* Linien: jeder Mini-Nordstern zeigt auf den Nordstern; Nachbarn sind leise verbunden. */
    pos.forEach(function (p, k) {
      var st = L.sterne[k], an = st.id === WAHL;
      s += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + nx + '" y2="' + ny + '" stroke="' + (an ? '#ffe9a8' : '#9fb0d8') +
           '" stroke-opacity="' + (an ? .85 : .28) + '" stroke-width="' + (an ? 2.2 : 1.2) + '"' + (an ? '' : ' stroke-dasharray="4 6"') + '/>';
      if (k) s += '<line x1="' + pos[k - 1].x + '" y1="' + pos[k - 1].y + '" x2="' + p.x + '" y2="' + p.y + '" stroke="#9fb0d8" stroke-opacity=".16" stroke-width="1"/>';
    });
    /* Nordstern */
    s += '<circle cx="' + nx + '" cy="' + ny + '" r="46" fill="#ffe9a8" opacity=".10"/>' +
         '<circle cx="' + nx + '" cy="' + ny + '" r="28" fill="#ffe9a8" opacity=".16"/>' +
         '<path d="' + sternPfad(nx, ny, 26, 4, .28) + '" fill="#fff4cf"/>' +
         '<text x="' + nx + '" y="' + (ny + 58) + '" text-anchor="middle" fill="#fff4cf" font-family="Instrument Serif,Georgia,serif" font-size="26">' +
         esc(tx(L.nordstern.kurz || L.nordstern.titel)) + '</text>';
    /* Mini-Nordsterne */
    pos.forEach(function (p, k) {
      var st = L.sterne[k], an = st.id === WAHL, zahl = liste(st.ziele).length;
      var r = 13 + Math.min(zahl, 4) * 2.2;
      var f = FARBE_HELL[st.farbe] || '#c7ec8a';
      s += '<g class="sk-knopf" tabindex="0" role="button" data-stern="' + esc(st.id) + '" aria-label="' + esc(tx(st.titel)) + '">' +
           '<circle class="sk-ring" cx="' + p.x + '" cy="' + p.y + '" r="' + (r + 12) + '" fill="none" stroke="' + f + '" stroke-opacity="' + (an ? .9 : .25) + '" stroke-width="1.5"/>' +
           (an ? '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (r + 22) + '" fill="' + f + '" opacity=".10"/>' : '') +
           '<path d="' + sternPfad(p.x, p.y, r, 5, .45) + '" fill="' + f + '"/>' +
           '<text x="' + p.x + '" y="' + (p.y + r + 32) + '" text-anchor="middle" fill="#eef2ff" font-family="Inter,system-ui,sans-serif" font-size="16" font-weight="' + (an ? 800 : 600) + '" class="lbl">' +
           zeilen(tx(st.kurz || st.titel)).map(function (z, i) {
             return '<tspan x="' + p.x + '" dy="' + (i ? 19 : 0) + '">' + esc((i === 0 && st.icon ? st.icon + ' ' : '') + z) + '</tspan>';
           }).join('') + '</text></g>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(T[SPR()].kick) + '">' + s + '</svg>';
  }
  /* Im Nachthimmel braucht jede Farbe ihre helle Fassung — unabhängig vom Farbschema. */
  var FARBE_HELL = { gruen: '#c7ec8a', violett: '#b9a8ff', bernstein: '#f3c768', himmel: '#8ec3ff', rose: '#f19ab8', tuerkis: '#6fd8cc' };

  /* ---------- Bausteine --------------------------------------------------------------- */
  function menschenText(a) { return liste(a).map(esc).join(', '); }
  function initiativeHtml(ini) {
    var p = liste(ini.projekte).map(function (pr) {
      return '<li><span class="pf">▸</span><div>' + link(pr.link, esc(tx(pr.titel))) + (pr.wo ? ' <span class="sk-leer">· ' + esc(pr.wo) + '</span>' : '') +
             ' ' + statusPill(pr.stand) + (pr.naechster ? '<div class="nx">→ ' + esc(tx(pr.naechster)) + '</div>' : '') + '</div></li>';
    }).join('');
    return '<div class="sk-ini"><div class="it">' + esc(tx(ini.titel)) + ' ' + statusPill(ini.stand) + '</div>' +
           '<div class="wer">👤 <b>' + esc(ini.verantwortlich || '—') + '</b> ' + esc(T[SPR()].verantw) +
           (liste(ini.beteiligt).length ? ' · 👥 ' + esc(T[SPR()].beteiligt) + ' ' + menschenText(ini.beteiligt) : '') + '</div>' +
           (p ? '<ul>' + p + '</ul>' : '') + '</div>';
  }
  function zielHtml(z) {
    return '<div class="sk-ziel"><h5>' + esc(tx(z.titel)) + '</h5>' +
           '<div class="mess">' + (z.bis ? esc(T[SPR()].bis) + ' ' + datum(z.bis) + ' · ' : '') + esc(tx(z.messung || '')) + ' ' + statusPill(z.stand) + '</div>' +
           liste(z.initiativen).map(initiativeHtml).join('') + '</div>';
  }
  function sternDetail(st) {
    var merk = liste(st.kennzeichen).map(function (m) {
      return '<span>' + esc(tx(m.was)) + (m.ziel ? ' · <b>' + esc(tx(m.ziel)) + '</b>' : '') +
             (m.quelle ? '<i>' + esc(T[SPR()].quelle) + ': ' + esc(tx(m.quelle)) + '</i>' : '') + '</span>';
    }).join('');
    return '<div class="sk-dk" style="--sk-f:' + farbe(st) + '"><span class="ic">' + esc(st.icon || '✦') + '</span><div style="flex:1;min-width:240px">' +
           '<p class="kick" style="color:' + farbe(st) + '">' + esc(tx(st.untertitel || T[SPR()].kick)) + '</p>' +
           '<h3>' + esc(tx(st.titel)) + '</h3><p>' + esc(tx(st.satz)) + '</p>' +
           (merk ? '<div class="sk-merk" aria-label="' + esc(T[SPR()].woran) + '">' + merk + '</div>' : '') + '</div></div>' +
           '<div class="sk-ziele">' + (liste(st.ziele).map(zielHtml).join('') || '<p class="sk-leer">' + esc(T[SPR()].nichts) + '</p>') + '</div>';
  }
  /* Alles, woran eine Person verantwortlich oder beteiligt hängt — über alle Sterne. */
  function personDetail(name) {
    var h = '';
    L.sterne.forEach(function (st) {
      var z = [];
      liste(st.ziele).forEach(function (zi) {
        var ini = liste(zi.initiativen).filter(function (i) {
          return i.verantwortlich === name || liste(i.beteiligt).indexOf(name) >= 0;
        });
        if (ini.length) z.push('<div class="sk-ziel"><h5>' + esc(tx(zi.titel)) + '</h5>' + ini.map(initiativeHtml).join('') + '</div>');
      });
      if (z.length) h += '<div class="sk-dk" style="--sk-f:' + farbe(st) + ';margin-top:14px"><span class="ic">' + esc(st.icon || '✦') + '</span><div><h3 style="font-size:22px">' +
                         esc(tx(st.titel)) + '</h3></div></div><div class="sk-ziele">' + z.join('') + '</div>';
    });
    var m = liste(L.menschen).filter(function (x) { return x.name === name; })[0];
    return '<div class="sk-dk"><span class="ic">👤</span><div><p class="kick">' + esc(T[SPR()].anHaengt.replace('{n}', name)) + '</p><h3>' + esc(name) + '</h3>' +
           (m ? '<p>' + esc(tx(m.rolle)) + '</p>' : '') + '</div></div>' + (h || '<p class="sk-leer">' + esc(T[SPR()].nichts) + '</p>');
  }
  function jetztHtml() {
    var j = [];
    L.sterne.forEach(function (st) {
      liste(st.ziele).forEach(function (z) {
        liste(z.initiativen).forEach(function (i) {
          liste(i.projekte).forEach(function (p) {
            if (p.jetzt && p.naechster) j.push({ st: st, p: p, i: i });
          });
        });
      });
    });
    if (!j.length) return '';
    j.sort(function (a, b) { return (a.p.jetzt === true ? 9 : a.p.jetzt) - (b.p.jetzt === true ? 9 : b.p.jetzt); });
    return '<div class="sk-jetzt"><h4>' + esc(T[SPR()].jetzt) + '</h4><ol>' + j.slice(0, 5).map(function (x) {
      return '<li><span style="color:' + farbe(x.st) + '">' + esc(x.st.icon || '✦') + '</span> <b>' + esc(tx(x.p.naechster)) + '</b> <span class="sk-leer">— ' +
             esc(tx(x.p.titel)) + ' · 👤 ' + esc(x.i.verantwortlich || '—') + '</span></li>';
    }).join('') + '</ol></div>';
  }
  function routeHtml() {
    var r = liste(L.route);
    if (!r.length) return '';
    var sternVon = {}; L.sterne.forEach(function (s) { sternVon[s.id] = s; });
    return '<div class="sk-block"><h4 class="sk-h">' + esc(T[SPR()].route) + '</h4><div class="sk-route">' + r.map(function (e) {
      return '<div class="sk-etappe"><div class="et">' + esc(tx(e.titel)) + '</div>' + (e.satz ? '<div class="es">' + esc(tx(e.satz)) + '</div>' : '') +
             '<ul>' + liste(e.meilensteine).map(function (m) {
               var st = sternVon[m.stern];
               return '<li><span class="dot" style="background:' + (st ? farbe(st) : 'var(--sub)') + '"></span><span>' + esc(tx(m.titel)) +
                      (m.bis ? ' <span class="sk-leer">· ' + datum(m.bis) + '</span>' : '') + '</span></li>';
             }).join('') + '</ul></div>';
    }).join('') + '</div></div>';
  }
  function menschenHtml() {
    var m = liste(L.menschen);
    if (!m.length) return '';
    return '<div class="sk-block"><h4 class="sk-h">' + esc(T[SPR()].menschen) + '</h4><div class="sk-leute">' + m.map(function (x) {
      return '<button type="button" data-person="' + esc(x.name) + '" aria-pressed="' + (PERSON === x.name) + '"><b>' + esc(x.name) + '</b><span>' + esc(tx(x.rolle)) + '</span></button>';
    }).join('') + '</div></div>';
  }
  function reibungHtml() {
    var r = liste(L.spannungen);
    if (!r.length) return '';
    return '<div class="sk-block"><h4 class="sk-h">' + esc(T[SPR()].reibung) + '</h4><div class="sk-reib">' + r.map(function (x) {
      return '<div>' + esc(tx(x.satz)) + (x.regel ? '<i>' + esc(T[SPR()].regel) + ': ' + esc(tx(x.regel)) + '</i>' : '') + '</div>';
    }).join('') + '</div></div>';
  }

  /* ---------- Zeichnen ---------------------------------------------------------------- */
  function zeichne() {
    var t = T[SPR()], ns = L.nordstern;
    var st = L.sterne.filter(function (s) { return s.id === WAHL; })[0] || L.sterne[0];
    var wahl = L.sterne.map(function (s, k) {
      return '<button type="button" data-stern="' + esc(s.id) + '" aria-pressed="' + (!PERSON && s.id === st.id) + '" style="--sk-f:' + farbe(s) + '" title="⇧' + (k + 1) + '">' +
             '<span class="dot"></span>' + esc((s.icon ? s.icon + ' ' : '') + tx(s.kurz || s.titel)) + '</button>';
    }).join('');
    ziel.innerHTML =
      '<div class="sk-kopf"><span class="bic" style="width:52px;height:52px;border-radius:14px;background:var(--surface);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:26px;flex:none">✦</span>' +
      '<div class="bt"><p class="kick">' + esc(t.kick) + (L.stand ? ' · ' + esc(t.stand) + ' ' + datum(L.stand) : '') + '</p>' +
      '<h2>' + esc(tx(ns.titel)) + '</h2><p class="sub">' + esc(tx(ns.satz)) + '</p>' +
      (liste(L.prinzipien).length ? '<div class="sk-prinz" aria-label="' + esc(t.prinzipien) + '">' + liste(L.prinzipien).map(function (p) { return '<span>' + esc(tx(p)) + '</span>'; }).join('') + '</div>' : '') +
      '</div></div>' +
      '<div class="sk-himmel">' + himmel() + '</div>' +
      '<div class="sk-wahl">' + wahl + '</div>' +
      jetztHtml() +
      '<div class="sk-detail" id="skDetail">' + (PERSON ? personDetail(PERSON) : sternDetail(st)) + '</div>' +
      routeHtml() + menschenHtml() + reibungHtml();
    ziel.querySelectorAll('.sk-h').forEach(function (h) {
      h.style.cssText = 'margin:0 0 10px;font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--sub);font-family:Inter';
    });
  }
  function zeige(id) {
    if (!L.sterne.some(function (s) { return s.id === id; })) return false;
    WAHL = id; PERSON = null; zeichne();
    try { history.replaceState(null, '', '#stern-' + id); } catch (e) {}
    return true;
  }
  ziel.addEventListener('click', function (e) {
    var s = e.target.closest('[data-stern]');
    if (s) { zeige(s.getAttribute('data-stern')); return; }
    var p = e.target.closest('[data-person]');
    if (p) {
      var n = p.getAttribute('data-person');
      PERSON = PERSON === n ? null : n; zeichne();
      var d = document.getElementById('skDetail'); if (d && PERSON) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  ziel.addEventListener('keydown', function (e) {
    var s = e.target.closest && e.target.closest('g[data-stern]');
    if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); zeige(s.getAttribute('data-stern')); }
  });
  /* ⇧1…⇧9 wählt einen Stern — die Ziffern allein gehören den Kacheln der Brücke. */
  document.addEventListener('keydown', function (e) {
    if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    var m = /^Digit([1-9])$/.exec(e.code || '');
    if (!m) return;
    var st = L.sterne[+m[1] - 1];
    if (st && zeige(st.id)) ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  addEventListener('hashchange', function () {
    var m = /#stern-([\w-]+)/.exec(location.hash); if (m) zeige(m[1]);
  });
  /* Die Brücke zeichnet Navigation und Sprache neu (zeichne() in portal.html) — danach
     hängt sich die Sternenkarte wieder in die Navigation und folgt der Sprache. */
  function navEintrag() {
    var nav = document.getElementById('navlinks');
    if (nav && !nav.querySelector('a[href="#sternenkarte"]')) {
      var a = document.createElement('a'); a.href = '#sternenkarte'; a.textContent = T[SPR()].nav;
      nav.insertBefore(a, nav.firstChild);
    }
  }
  new MutationObserver(function () { navEintrag(); }).observe(document.getElementById('navlinks') || document.body, { childList: true });
  var sprAlt = SPR();
  new MutationObserver(function () { if (SPR() !== sprAlt) { sprAlt = SPR(); zeichne(); navEintrag(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  ziel.hidden = false;
  zeichne();
  navEintrag();
  if (/#stern-|#sternenkarte/.test(location.hash)) setTimeout(function () { ziel.scrollIntoView({ block: 'start' }); }, 60);
  window.STERNENKARTE = { zeige: zeige, daten: L };
})();
