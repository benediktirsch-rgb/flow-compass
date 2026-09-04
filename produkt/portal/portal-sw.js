/* Mein Portal — Service Worker der Subdomain-Wurzel (04.09.2026)
 *
 * Zwei Aufgaben:
 *   1) Das Portal offline öffnen können (Netz zuerst, Cache als Rückfallebene —
 *      dieselbe Strategie wie im Compass: lieber kurz laden als alte Zahlen zeigen).
 *   2) Den Vorgänger ablösen. Bis zum 04.09.2026 lag der Compass an der Wurzel und
 *      hat hier einen Service Worker mit Scope "/" registriert; dessen Cache enthält
 *      die alte Startseite. Ohne diesen Nachfolger bekämen Menschen, die die App
 *      schon installiert haben, weiter den alten Stand aus dem Cache serviert.
 *
 * Caches werden nur im eigenen Namensraum aufgeräumt (Präfix 'portal-'): der Compass
 * in /compass/ hat einen eigenen Service Worker mit eigenem Cache ('compass-…'), und
 * Caches gelten pro Ursprung, nicht pro Scope. Wer hier pauschal alles Fremde löscht,
 * löscht dem Nachbarn seinen Cache — und der löscht zurück.
 */
const CACHE = 'portal-v1';

const GERUEST = [
  './',
  './index.html',
  './portal.js',
  './fonts.css',
  './manifest.webmanifest',
  './app-icons/icon-192.png',
  './app-icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* Einzeln, nicht addAll: eine fehlende Datei darf die Installation nicht kippen. */
    await Promise.all(GERUEST.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    /* Eigene alte Stände + der Cache des Compass, als er noch an der Wurzel lag.
       Der heutige Compass-Cache heisst 'compass-v2' und bleibt unangetastet. */
    await Promise.all(namen
      .filter(n => (n.startsWith('portal-') && n !== CACHE) || n === 'compass-v1')
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  /* Der Compass bedient sich selbst — sein eigener Service Worker hat den engeren
     Scope und gewinnt ohnehin; hier gar nicht erst anfassen. */
  if (url.pathname.indexOf('/compass/') === 0) return;

  e.respondWith((async () => {
    try {
      const antwort = await fetch(req);
      if (antwort && antwort.ok && antwort.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, antwort.clone()).catch(() => {});
      }
      return antwort;
    } catch (err) {
      const treffer = await caches.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      if (req.mode === 'navigate') {
        const start = await caches.match('./index.html', { ignoreSearch: true });
        if (start) return start;
      }
      throw err;
    }
  })());
});
