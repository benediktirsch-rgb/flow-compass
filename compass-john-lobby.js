/* compass-john-lobby.js — Johns Lobby (10.09.2026)

   Benes Bestellung: „sobald John weg ist, geb mir ein Layover-Fenster, das ihn direkt startet."

   Die Lobby ist der Warteraum vor Johns Zimmer. Sie erscheint genau dann, wenn John gerade nicht
   antworten kann, und tut drei Dinge:
     1. sie sagt, WAS ist — belegt, aus, oder dieses Gerät kann ihn nicht starten. Bis heute stand
        an 18 Stellen in dashboard.html derselbe Satz („John-Server nicht erreichbar") für drei
        völlig verschiedene Lagen;
     2. sie zeigt Johns letzten Stand aus der Rezeption (hotel-vaikuntha.de/john/), damit eine
        Unterbrechung nicht wie „nichts zu tun" aussieht;
     3. sie startet ihn — über die Tür des Geräte-Workers (127.0.0.1:8788), nicht über eine
        Anleitung zum Abtippen.

   Sie verschwindet von selbst, sobald John wieder antwortet, und drängt nicht: kein Blinken,
   kein Druck. Ruhiger Mentor, auch im Fehlerfall.

   Hängt sich wie compass-live.js von außen an; dashboard.html bleibt bis auf das <script>-Tag
   unberührt. Ist kein Coach-Server eingerichtet (Demo, fremde Instanz), tut die Datei nichts.

   Quelle dieser Datei: C:\dev\john-agent\compass\ — dort wird sie gepflegt, nach flow-compass
   kopiert sie geraet\john-aufgaben.ps1 -Sync.                                                    */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__johnLobby) return;                       // zweimal geladen: einmal reicht

  /* ---------- Umgebung ------------------------------------------------------------------ */
  const API = () => (typeof JOHN_API === 'string' ? JOHN_API : '');
  const esc = (typeof window.esc === 'function') ? window.esc
    : (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const sag = (m, art) => { try { if (typeof toast === 'function') toast(m, art); else console.log(m); } catch (e) { } };

  /* Die Tür des Geräte-Workers. Vom Handy oder aus dem Netz ist sie nicht erreichbar — das ist
     kein Fehler, sondern der Grund, warum es die Rezeption gibt. */
  const TUER = (window.JOHN_TUER || 'http://127.0.0.1:8788').replace(/\/$/, '');
  /* Rezeption: beim Bauen der eigenen Instanz eingesetzt (build-compass.ps1), sonst aus dem
     Browser-Speicher. Ohne Rezeption bleibt die Lobby ehrlich und zeigt keinen Stand. */
  const HUB = (window.JOHN_HUB || localStorage.getItem('compassJohnHub') || '').replace(/\/$/, '');
  const HUB_TOKEN = window.JOHN_HUB_TOKEN || localStorage.getItem('compassJohnHubToken') || '';

  const KEIN_JOHN = !API() && !location.port && !HUB && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  const SNOOZE_MS = 10 * 60 * 1000;   // „Später" hält zehn Minuten
  const PROBE_MS_ZU = 30 * 1000;      // Lobby geschlossen: alle 30 s nachsehen
  const PROBE_MS_OFFEN = 5 * 1000;    // Lobby offen: alle 5 s
  const T_TUER = 1500, T_SERVER = 4000, T_HUB = 6000;

  /* ---------- Stil ---------------------------------------------------------------------- */
  const css = document.createElement('style');
  css.textContent = `
.jlb-hg{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(8,10,9,.62);backdrop-filter:blur(3px);animation:jlbAuf .18s ease-out}
.jlb-hg[hidden]{display:none!important}
@keyframes jlbAuf{from{opacity:0}to{opacity:1}}
.jlb{width:100%;max-width:540px;max-height:88vh;overflow:auto;background:var(--panel,#141712);color:var(--ink,#e9eee4);
  border:1px solid var(--line2,#39412f);border-radius:16px;padding:18px 18px 14px;box-shadow:0 24px 60px rgba(0,0,0,.45)}
.jlb h2{margin:0 0 2px;font-size:19px;font-weight:650;letter-spacing:.1px}
.jlb .jlb-sub{color:var(--dim,#9aa48c);font-size:12.5px;margin:0 0 12px}
.jlb .jlb-lage{background:var(--panel2,#1b1f18);border:1px solid var(--line,#2b3124);border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13.5px;line-height:1.55}
.jlb .jlb-lage b{color:var(--ink,#e9eee4)}
.jlb .jlb-lage .jlb-warum{display:block;color:var(--dim,#9aa48c);font-size:12px;margin-top:4px}
.jlb .jlb-stand{margin:0 0 12px}
.jlb .jlb-stand .jlb-kopf{font-size:11.5px;color:var(--dim,#9aa48c);text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px}
.jlb .jlb-p{border-left:2px solid var(--line2,#39412f);padding:2px 0 2px 10px;margin:0 0 8px;font-size:13px;opacity:.86}
.jlb .jlb-p b{display:block;font-weight:600}
.jlb .jlb-p span{color:var(--dim,#9aa48c);font-size:12px}
.jlb .jlb-tasten{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.jlb .jlb-b{appearance:none;cursor:pointer;font:inherit;font-size:13px;padding:8px 14px;border-radius:10px;
  border:1px solid var(--line2,#39412f);background:var(--panel2,#1b1f18);color:var(--ink,#e9eee4)}
.jlb .jlb-b:hover{border-color:var(--va-l,#8fd14f)}
.jlb .jlb-b.jlb-haupt{background:var(--va,#5b8c1f);border-color:var(--va,#5b8c1f);color:#fff;font-weight:600}
.jlb .jlb-b.jlb-haupt:hover{filter:brightness(1.1)}
.jlb .jlb-b:disabled{opacity:.55;cursor:wait}
.jlb .jlb-b.jlb-still{background:transparent;border-color:transparent;color:var(--dim,#9aa48c);padding-left:6px;padding-right:6px}
.jlb .jlb-fuss{margin:12px 0 0;font-size:11.5px;color:var(--dim,#9aa48c);line-height:1.5}
.jlb .jlb-hilfe{margin:10px 0 0;padding:10px 12px;background:var(--panel2,#1b1f18);border:1px solid var(--line,#2b3124);
  border-radius:10px;font-size:12.5px;line-height:1.6}
.jlb .jlb-hilfe code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;background:rgba(0,0,0,.28);padding:1px 5px;border-radius:5px;word-break:break-all}
.jlb-pille{position:fixed;right:14px;bottom:14px;z-index:8500;display:flex;align-items:center;gap:7px;cursor:pointer;
  font:inherit;font-size:12px;padding:7px 12px;border-radius:999px;border:1px solid var(--line2,#39412f);
  background:var(--panel,#141712);color:var(--dim,#9aa48c);box-shadow:0 6px 18px rgba(0,0,0,.3)}
.jlb-pille[hidden]{display:none!important}
.jlb-pille:hover{color:var(--ink,#e9eee4);border-color:var(--va-l,#8fd14f)}
.jlb-pille .jlb-pkt{width:7px;height:7px;border-radius:50%;background:#d9a13b;flex:none}
.jlb-pille.jlb-aus .jlb-pkt{background:#c46a5e}
@media(max-width:520px){.jlb{padding:14px 14px 12px}.jlb .jlb-tasten .jlb-b{flex:1 1 auto}}
`;
  document.head.appendChild(css);

  /* ---------- Zustand ------------------------------------------------------------------- */
  const Z = {
    hg: null, box: null, pille: null,
    offen: false, snoozeBis: 0, timer: null,
    fehlschlaege: 0,          // zwei in Folge, dann erst die Lobby (ein Aussetzer ist kein Ausfall)
    lage: null,               // 'ok' | 'belegt' | 'aus' | 'fremd'
    tuer: null,               // Antwort des Workers
    hub: null,                // Antwort der Rezeption
    startLaeuft: false,
    seit: 0
  };

  /* ---------- Fragen stellen ------------------------------------------------------------ */
  async function hol(url, ms, kopf) {
    const opt = { cache: 'no-store', signal: AbortSignal.timeout(ms) };
    if (kopf) opt.headers = kopf;
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  const fragTuer = () => hol(TUER + '/stand', T_TUER).catch(() => null);
  const fragServer = () => hol(API() + '/api/john/status', T_SERVER).catch(() => null);
  const fragHub = () => (HUB && HUB_TOKEN)
    ? hol(HUB + '/api.php?w=stand', T_HUB, { 'X-John-Token': HUB_TOKEN }).catch(() => null)
    : Promise.resolve(null);

  /* Eine Runde: erst das Gerät (schnell und auskunftsfähig), dann der Cockpit-Server,
     dann die Rezeption. Die Reihenfolge ist Absicht — die Tür ist die einzige Stelle, die
     „belegt" von „aus" unterscheiden kann, weil sie neben dem Server lebt und nicht in ihm. */
  async function runde() {
    const [tuer, server] = await Promise.all([fragTuer(), fragServer()]);
    Z.tuer = tuer;
    if (server && server.ok) {
      Z.lage = 'ok'; Z.fehlschlaege = 0;
      return true;
    }
    Z.fehlschlaege++;
    if (tuer) {
      /* Der Worker lebt und weiß, wie es dem großen Server geht — vier verschiedene Lagen,
         die von außen alle gleich aussehen. Der wichtigste Fall ist der erste: der Server
         läuft und antwortet dem Gerät, nur diese Seite kommt nicht an ihn heran. Das ist
         kein Ausfall, sondern eine falsche Adresse — und das hat vorher niemand gesehen. */
      if (tuer.denkt) Z.lage = 'belegt';
      else if (tuer.serverOk === true) Z.lage = 'adresse';
      else if (tuer.serverLaeuft) Z.lage = 'haengt';
      else Z.lage = 'aus';
    } else if (KEIN_JOHN) {
      Z.lage = 'fremd';
    } else {
      Z.lage = 'unklar';
    }
    Z.hub = await fragHub();
    return false;
  }

  /* ---------- Sätze — vier Lagen, vier Sätze, nie einer für alles --------------------- */
  function lageText() {
    const g = (Z.hub && Array.isArray(Z.hub.geraete)) ? Z.hub.geraete.filter(x => x && x.wach) : [];
    switch (Z.lage) {
      case 'belegt':
        return { titel: 'John denkt gerade',
          text: '<b>Er ist da, aber belegt.</b> Ein Denkvorgang dauert bis zu 90 Sekunden; solange beantwortet er nichts anderes.',
          warum: 'Das Gerät meldet: Prozess läuft' + (Z.tuer && Z.tuer.denktSeit ? ', denkt seit ' + esc(uhr(Z.tuer.denktSeit)) : '') + '.',
          startbar: false };
      case 'adresse':
        return { titel: 'John läuft — diese Seite erreicht ihn nicht',
          text: '<b>Auf dem Gerät antwortet er.</b> Nur der Weg von dieser Seite dorthin ist zu: '
            + (API() ? '<code>' + esc(API()) + '</code>' : 'gleiche Adresse wie diese Seite')
            + ' liefert nichts.',
          warum: 'Meist ist die Adresse im Compass falsch gesetzt (Browser-Speicher <code>compassJohnApi</code>) oder der Browser blockt den Weg ins lokale Netz.',
          startbar: false };
      case 'haengt':
        return { titel: 'John hängt',
          text: '<b>Sein Server lebt, antwortet aber nicht mehr.</b> Ein Neustart holt ihn zurück — ich mache das von hier.',
          warum: 'Das Gerät meldet: Prozess läuft, letzte Antwort ' + (Z.tuer && Z.tuer.serverAntwortZeit ? esc(uhr(Z.tuer.serverAntwortZeit)) : 'unbekannt') + '.',
          startbar: true };
      case 'aus':
        return { titel: 'John ist aus',
          text: '<b>Auf diesem Rechner läuft sein Server nicht.</b> Ich kann ihn von hier starten.',
          warum: 'Das Gerät ist wach, der Cockpit-Server auf Port 8787 nicht.',
          startbar: true };
      case 'fremd':
        return { titel: 'John wohnt nicht auf diesem Gerät',
          text: '<b>Von hier kann ich ihn nicht starten</b> — aber sein Stand steht unten, sobald die Rezeption eingerichtet ist.',
          warum: 'Kein lokaler Coach-Server und keine Rezeption hinterlegt.',
          startbar: false };
      default:
        return { titel: 'John antwortet nicht',
          text: g.length
            ? '<b>Sein Stand lebt weiter</b> — die Rezeption kennt ihn. Nur dieses Gerät erreicht ihn gerade nicht.'
            : '<b>Entweder denkt er gerade, oder er ist aus.</b> Sicher sagen kann das nur der Geräte-Worker; der antwortet hier nicht.',
          warum: 'Kein Wort von Port 8787' + (Z.fehlschlaege > 1 ? ' (' + Z.fehlschlaege + ' Versuche)' : '') + ', keine Tür auf 8788.',
          startbar: true };
    }
  }

  function uhr(iso) {
    try {
      const d = new Date(iso); if (isNaN(d)) return '';
      const heute = new Date();
      const t = d.toDateString() === heute.toDateString();
      return (t ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ')
        + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /* Johns letzter Stand: erst die Rezeption (gilt überall), sonst die Browser-Kopie des
     Stapels (gilt nur hier — und das sagt die Zeile dann auch). */
  function standHtml() {
    let punkte = null, stand = '', quelle = '';
    if (Z.hub && Z.hub.stapel && Array.isArray(Z.hub.stapel.punkte) && Z.hub.stapel.punkte.length) {
      punkte = Z.hub.stapel.punkte.slice(0, 3); stand = Z.hub.stapel.stand; quelle = 'Rezeption';
    } else {
      try {
        const roh = JSON.parse(localStorage.getItem('compassStapel') || 'null');
        const arr = roh && (Array.isArray(roh) ? roh : roh.punkte);
        if (arr && arr.length) { punkte = arr.slice(0, 3); stand = roh.stand || ''; quelle = 'Kopie in diesem Browser'; }
      } catch (e) { }
    }
    if (!punkte) {
      return '<div class="jlb-stand"><p class="jlb-kopf">Sein Stapel</p>'
        + '<div class="jlb-p"><span>Kein Stand hinterlegt. <b style="display:inline;font-weight:600">Leer heißt hier nicht „nichts zu tun"</b> — es heißt: von dieser Stelle aus ist sein Stapel nicht lesbar.</span></div></div>';
    }
    return '<div class="jlb-stand"><p class="jlb-kopf">Sein Stapel'
      + (stand ? ' · Stand ' + esc(uhr(stand)) : '') + (quelle ? ' · ' + esc(quelle) : '') + '</p>'
      + punkte.map(p => '<div class="jlb-p"><b>' + esc(p.titel || p.text || '—') + '</b>'
        + (p.warum ? '<span>' + esc(p.warum) + '</span>' : '') + '</div>').join('')
      + '</div>';
  }

  function fussHtml() {
    const teile = [];
    teile.push('Die Aufgabe „John Server" versucht es <b>jede Minute</b> von selbst — meist ist er von allein wieder da.');
    if (Z.hub) {
      const wach = (Z.hub.geraete || []).filter(g => g && g.wach).map(g => g.name);
      teile.push('Rezeption: ' + (wach.length ? 'wach auf ' + esc(wach.join(', ')) : '<b>kein Gerät wach</b> — Johns Hände schlafen, sein Zimmer ist besetzt.'));
    } else if (HUB) {
      teile.push('Rezeption (' + esc(HUB) + ') antwortet nicht.');
    } else {
      teile.push('Keine Rezeption hinterlegt — sein Stand hängt an diesem Rechner. (john-agent, <code>docs/kas-schritte.md</code>)');
    }
    /* Wann hat John zuletzt von selbst gedacht? Es gibt Logs, aber niemand liest Logs — diese
       eine Zeile ist der Wächter, den Madeleine und ich beide als größte Lücke gesehen haben. */
    const tk = (Z.hub && Z.hub.takt && Z.hub.takt.letzter) || (Z.tuer && Z.tuer.takt && Z.tuer.takt.letzter) || null;
    if (tk) {
      const tage = Math.floor((Date.now() - new Date(tk).getTime()) / 86400000);
      teile.push('Johns letzter eigener Takt: ' + esc(uhr(tk))
        + (tage >= 2 ? ' — <b>seit ' + tage + ' Tagen still.</b> Das ist zu lang; lies <code>geraet\\john-auftrag.log</code>.' : ''));
    } else if (Z.hub || Z.tuer) {
      teile.push('Ein eigener Takt ist noch nicht gelaufen (Fenster Mo–Fr 6:30–21:30).');
    }
    return '<p class="jlb-fuss">' + teile.join('<br>') + '</p>';
  }

  /* ---------- Bauen ---------------------------------------------------------------------- */
  function bauen() {
    if (Z.hg) return;
    Z.hg = document.createElement('div');
    Z.hg.className = 'jlb-hg'; Z.hg.hidden = true;
    Z.hg.setAttribute('role', 'dialog'); Z.hg.setAttribute('aria-modal', 'true'); Z.hg.setAttribute('aria-label', 'Johns Lobby');
    Z.box = document.createElement('div'); Z.box.className = 'jlb';
    Z.hg.appendChild(Z.box);
    document.body.appendChild(Z.hg);
    Z.hg.addEventListener('click', e => { if (e.target === Z.hg) spaeter(); });
    document.addEventListener('keydown', e => { if (Z.offen && e.key === 'Escape') { e.stopPropagation(); spaeter(); } }, true);

    Z.pille = document.createElement('button');
    Z.pille.type = 'button'; Z.pille.className = 'jlb-pille'; Z.pille.hidden = true;
    Z.pille.addEventListener('click', () => oeffnen());
    document.body.appendChild(Z.pille);
  }

  function malen() {
    const l = lageText();
    const wartezeit = Z.seit ? Math.round((Date.now() - Z.seit) / 1000) : 0;
    Z.box.innerHTML =
      '<h2>🤵 ' + esc(l.titel) + '</h2>'
      + '<p class="jlb-sub">Johns Lobby' + (wartezeit > 20 ? ' · seit ' + Math.round(wartezeit / 60 || 1) + ' Min hier' : '') + '</p>'
      + '<div class="jlb-lage">' + l.text + '<span class="jlb-warum">' + l.warum + '</span></div>'
      + standHtml()
      + '<div class="jlb-tasten">'
      + (l.startbar ? '<button type="button" class="jlb-b jlb-haupt" data-t="start">▶ John starten</button>' : '')
      + '<button type="button" class="jlb-b" data-t="neu">↻ Nochmal nachsehen</button>'
      + '<button type="button" class="jlb-b jlb-still" data-t="spaeter">Später</button>'
      + '</div>'
      + '<div id="jlbHilfe"></div>'
      + fussHtml();
    Z.box.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = b.getAttribute('data-t');
      if (t === 'start') starten(b);
      else if (t === 'neu') nachsehen(b);
      else spaeter();
    }));
  }

  /* ---------- Starten ------------------------------------------------------------------- */
  /* Erst die Tür des Workers (der lebt neben dem Server und darf Prozesse starten), dann das
     Protokoll john:// (einmalig eingerichtet von geraet\john-protokoll.ps1). Klappt beides
     nicht, sagt die Lobby genau das — statt eine Anleitung zum Abtippen zu geben. */
  async function starten(knopf) {
    if (Z.startLaeuft) return;
    Z.startLaeuft = true;
    const alt = knopf ? knopf.textContent : '';
    if (knopf) { knopf.disabled = true; knopf.textContent = '… wird gestartet'; }
    const hilfe = document.getElementById('jlbHilfe');
    let geschafft = false, weg = '';
    try {
      const r = await fetch(TUER + '/wecken', { method: 'POST', signal: AbortSignal.timeout(8000) });
      if (r.ok) { geschafft = true; weg = 'Tür des Geräts'; }
    } catch (e) { }
    if (!geschafft) {
      try { window.location.href = 'john://start'; weg = 'john://start'; } catch (e) { }
      await new Promise(r => setTimeout(r, 2500));
      const nach = await fragTuer().catch(() => null) || await fragServer().catch(() => null);
      if (nach) { geschafft = true; }
    }
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
    Z.startLaeuft = false;
    if (geschafft) {
      sag('John wird gestartet' + (weg ? ' (' + weg + ')' : '') + ' — ich sehe alle 5 Sekunden nach.', 'ok');
      if (hilfe) hilfe.innerHTML = '';
      warten();
      return;
    }
    if (hilfe) {
      hilfe.innerHTML = '<div class="jlb-hilfe">Von hier aus kam ich nicht an ihn heran: die Tür des Geräts '
        + '(<code>127.0.0.1:8788</code>) antwortet nicht, und <code>john://start</code> ist auf diesem Rechner '
        + 'nicht eingerichtet.<br><br><b>Zwei Dinge helfen dauerhaft:</b><br>'
        + '· Worker + Aufgaben einrichten: <code>john-agent\\geraet\\john-aufgaben.ps1 -Register</code><br>'
        + '· Startbefehl im Browser erlauben: <code>john-agent\\geraet\\john-protokoll.ps1 -Register</code><br><br>'
        + 'Bis dahin holt ihn die geplante Aufgabe „John Server" innerhalb einer Minute selbst zurück — '
        + 'dieses Fenster schließt sich dann von allein.</div>';
    }
    sag('Start von hier nicht möglich — die Aufgabe holt ihn innerhalb einer Minute zurück.', 'warn');
  }

  async function nachsehen(knopf) {
    const alt = knopf ? knopf.textContent : '';
    if (knopf) { knopf.disabled = true; knopf.textContent = '… sehe nach'; }
    const da = await runde();
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
    if (da) wiederDa(); else malen();
  }

  /* ---------- Auf und zu ---------------------------------------------------------------- */
  function oeffnen() {
    bauen();
    if (!Z.seit) Z.seit = Date.now();
    Z.offen = true; Z.snoozeBis = 0;
    malen();
    Z.hg.hidden = false;
    if (Z.pille) Z.pille.hidden = true;
    takt(PROBE_MS_OFFEN);
  }
  function schliessen() {
    if (Z.hg) Z.hg.hidden = true;
    Z.offen = false;
  }
  function spaeter() {
    Z.snoozeBis = Date.now() + SNOOZE_MS;
    schliessen();
    pilleZeigen();
    takt(PROBE_MS_ZU);
  }
  function pilleZeigen() {
    if (!Z.pille) return;
    Z.pille.hidden = false;
    Z.pille.className = 'jlb-pille' + (Z.lage === 'aus' ? ' jlb-aus' : '');
    const wort = { belegt: 'John denkt', aus: 'John ist aus', haengt: 'John hängt',
                   adresse: 'John: falsche Adresse', fremd: 'John: anderes Gerät' };
    Z.pille.innerHTML = '<span class="jlb-pkt"></span>🤵 ' + (wort[Z.lage] || 'John antwortet nicht');
  }
  function wiederDa() {
    const warEr = Z.offen || (Z.pille && !Z.pille.hidden);
    schliessen();
    if (Z.pille) Z.pille.hidden = true;
    Z.seit = 0; Z.snoozeBis = 0; Z.fehlschlaege = 0;
    if (warEr) sag('🤵 John ist wieder da.', 'ok');
    takt(PROBE_MS_ZU);
  }
  function warten() { takt(PROBE_MS_OFFEN); }

  /* ---------- Der eigene Takt ----------------------------------------------------------- */
  function takt(ms) {
    if (Z.timer) clearTimeout(Z.timer);
    Z.timer = setTimeout(schlag, ms);
  }
  async function schlag() {
    if (document.hidden) { takt(PROBE_MS_ZU); return; }   // im Hintergrund niemanden befragen
    const da = await runde();
    if (da) { wiederDa(); return; }
    /* Erst der zweite Fehlschlag in Folge öffnet die Lobby. Ein einzelner Aussetzer während
       eines Denkvorgangs ist kein Ausfall, und ein Fenster, das grundlos aufgeht, verliert
       jedes Vertrauen. Die Gegenprobe kommt aber schnell (4 s) — Bene soll nicht eine halbe
       Minute auf Karten starren, die „nicht erreichbar" sagen. */
    if (Z.fehlschlaege < 2) { takt(4000); return; }
    if (Z.offen) { malen(); takt(PROBE_MS_OFFEN); return; }
    if (Date.now() < Z.snoozeBis) { pilleZeigen(); takt(PROBE_MS_ZU); return; }
    oeffnen();
  }

  /* ---------- Anlaufen ------------------------------------------------------------------ */
  if (KEIN_JOHN) return;   // Demo oder fremde Instanz: nichts anzeigen, nichts abfragen
  bauen();
  /* Zwei Sekunden Anlauf: beim Laden fragen ohnehin ein Dutzend Karten den Server, und wer
     gerade F5 gedrückt hat, will nicht als erstes ein Fenster sehen. */
  setTimeout(() => { takt(0); }, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !Z.offen) takt(1200); });

  window.__johnLobby = true;
  window.johnLobby = {
    oeffnen, schliessen, starten, nachsehen,
    stand: () => ({ lage: Z.lage, tuer: Z.tuer, hub: Z.hub, fehlschlaege: Z.fehlschlaege, tuerUrl: TUER, hubUrl: HUB || null })
  };
})();
