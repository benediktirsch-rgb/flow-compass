/* Flow Compass — Installieren als App (04.09.2026)
 *
 * Warum ueberhaupt: der Compass ist ein Morgen- und Abendwerkzeug. Auf dem Handy ist der
 * Weg dorthin heute "Browser oeffnen, Lesezeichen suchen, warten" — dabei geht genau die
 * Gewohnheit verloren, die das ganze Werkzeug traegt. Als installierte App liegt er als
 * Symbol auf dem Startbildschirm, startet ohne Adresszeile und öffnet auch ohne Netz.
 *
 * Ehrlich bleiben: das ist eine PWA, kein Eintrag im App Store. Der Text sagt das auch so.
 * Auf Android/Chrome/Edge uebernimmt der Browser die Installation (beforeinstallprompt);
 * auf iOS gibt es diesen Haken nicht — dort bleibt "Teilen -> Zum Home-Bildschirm", und
 * genau diese zwei Schritte zeigt der Hinweis dann an, statt einen Knopf anzubieten,
 * der nichts tun kann.
 *
 * Der Balken kommt nicht ungefragt jeden Tag: einmal weggewischt, 30 Tage Ruhe
 * (localStorage compassAppWeg). Mit ?install=1 erscheint er sofort — so verlinkt die
 * Produktseite der Marke hierher, denn installieren laesst sich eine App
 * immer nur von ihrem eigenen Ursprung aus, nie von der Verkaufsseite.
 */
(function () {
  'use strict';

  var RUHE_TAGE = 30;
  var wunsch = null;          /* das aufgefangene beforeinstallprompt-Ereignis */
  var balken = null;

  function alsApp() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: window-controls-overlay)').matches ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function iOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function param(n) {
    try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; }
  }
  function ruhe() {
    try {
      var t = parseInt(localStorage.getItem('compassAppWeg') || '0', 10);
      return t && (Date.now() - t) < RUHE_TAGE * 864e5;
    } catch (e) { return false; }
  }
  function ruheSetzen() {
    try { localStorage.setItem('compassAppWeg', String(Date.now())); } catch (e) {}
  }

  /* ---- Service Worker ------------------------------------------------------
     Ohne ihn gibt es keine Installation und kein Offline. Er wird auch dann
     registriert, wenn der Balken nie erscheint — die App soll offline laufen,
     egal auf welchem Weg sie auf den Startbildschirm gekommen ist. */
  if ('serviceWorker' in navigator && window.isSecureContext) {   /* https oder localhost */
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    wunsch = e;
    zeigen();
  });

  window.addEventListener('appinstalled', function () {
    wunsch = null;
    ruheSetzen();
    if (balken) { balken.remove(); balken = null; }
  });

  function installieren() {
    if (!wunsch) return false;
    wunsch.prompt();
    wunsch.userChoice.then(function () { wunsch = null; if (balken) { balken.remove(); balken = null; } });
    return true;
  }

  function stil() {
    if (document.getElementById('compassAppStil')) return;
    var s = document.createElement('style');
    s.id = 'compassAppStil';
    s.textContent =
      '#compassApp{position:fixed;left:12px;right:12px;bottom:12px;z-index:9000;display:flex;gap:12px;' +
      'align-items:flex-start;background:var(--card,#fff);color:var(--ink,#1c2314);' +
      'border:1.5px solid var(--line-strong,#d5d0bd);border-radius:16px;padding:13px 14px;' +
      'box-shadow:0 14px 40px rgba(20,26,14,.22);font-size:13.5px;line-height:1.5;max-width:520px;margin:0 auto}' +
      '#compassApp img{width:38px;height:38px;border-radius:10px;flex:0 0 auto}' +
      '#compassApp b{display:block;font-size:14.5px;margin-bottom:2px}' +
      '#compassApp p{margin:0;color:var(--sub,#686f5d)}' +
      '#compassApp .cta{margin-top:9px;display:flex;gap:8px;flex-wrap:wrap}' +
      '#compassApp button{font:inherit;font-weight:700;border-radius:999px;padding:7px 14px;cursor:pointer;' +
      'border:1.5px solid var(--line-strong,#d5d0bd);background:transparent;color:inherit}' +
      '#compassApp button.ja{background:#4f7418;border-color:#4f7418;color:#fff}' +
      '@media(max-width:520px){#compassApp{font-size:13px}}';
    document.head.appendChild(s);
  }

  function zeigen(erzwingen) {
    if (alsApp()) return;                              /* laeuft schon als App */
    if (!erzwingen && ruhe()) return;
    if (balken) return;
    if (!wunsch && !iOS()) return;                     /* kein Weg, kein Versprechen */
    stil();

    balken = document.createElement('div');
    balken.id = 'compassApp';
    balken.setAttribute('role', 'dialog');
    balken.setAttribute('aria-label', 'Flow Compass als App installieren');

    var text = wunsch
      ? '<b>Compass als App</b><p>Auf den Startbildschirm legen — startet ohne Adresszeile und ' +
        'öffnet auch ohne Netz.</p>'
      : '<b>Compass auf den Startbildschirm</b><p>Tippe unten auf <b>Teilen</b> und dann auf ' +
        '<b>„Zum Home-Bildschirm“</b>. Danach startet der Compass wie eine App.</p>';

    balken.innerHTML =
      '<img src="app-icons/icon-192.png" alt="">' +
      '<div style="flex:1">' + text +
      '<div class="cta">' +
      (wunsch ? '<button type="button" class="ja" id="compassAppJa">App installieren</button>' : '') +
      '<button type="button" id="compassAppWeg">' + (wunsch ? 'Später' : 'Verstanden') + '</button>' +
      '</div></div>';

    document.body.appendChild(balken);
    var ja = document.getElementById('compassAppJa');
    if (ja) ja.addEventListener('click', installieren);
    document.getElementById('compassAppWeg').addEventListener('click', function () {
      ruheSetzen();
      if (balken) { balken.remove(); balken = null; }
    });
  }

  /* ?install=1 kommt von der Produktseite: dort steht der Knopf "Als App installieren",
     hier passiert es. Auf iOS erscheint dann die Anleitung, sonst der Knopf — sobald der
     Browser sein beforeinstallprompt geschickt hat (das kann eine Sekunde dauern). */
  if (param('install')) {
    window.addEventListener('load', function () { setTimeout(function () { zeigen(true); }, 1200); });
  }

  window.compassApp = { installieren: installieren, zeigen: function () { zeigen(true); }, alsApp: alsApp };
})();
