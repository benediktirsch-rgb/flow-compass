/* Flow Compass — Service Worker (04.09.2026)
 *
 * Zweck: der Compass laesst sich als App installieren (Android, iOS, Windows, macOS) und
 * oeffnet auch dann, wenn das Netz gerade weg ist — im Zug, im Keller, im Flugzeug.
 *
 * Strategie ist bewusst "Netz zuerst, Cache als Rueckfallebene" und NICHT umgekehrt:
 * der Compass zeigt Kennzahlen. Eine App, die morgens die Zahlen von vorgestern zeigt,
 * ohne es zu sagen, ist schlimmer als eine, die kurz laedt (Regel "keine erfundenen
 * Kacheln" gilt auch fuer alte). Jede erfolgreiche Antwort wandert in den Cache, damit
 * offline immer der zuletzt gesehene Stand daliegt — mit Datum, das die Seite selbst zeigt.
 *
 * Nicht angefasst wird alles, was nicht zu diesem Ursprung gehoert: der john-server auf
 * localhost:8787 liefert die Live-Quellen und darf nie aus einem Cache beantwortet werden.
 */
/* Der Name traegt einen Namensraum: Caches gelten pro Ursprung, nicht pro Scope.
   Seit dem 04.09.2026 liegt auf einer persoenlichen Subdomain das Portal an der Wurzel
   (eigener Service Worker, Cache 'portal-…') und der Compass in /compass/. Wer hier
   pauschal jeden fremden Cache loescht, loescht dem Nachbarn seinen — und der loescht
   zurueck. 'compass-v1' war der Stand, als der Compass noch an der Wurzel lag; der
   Portal-Worker raeumt ihn dort einmalig weg. */
const CACHE = 'compass-v2';

/* Nur das Geruest. Die Datenschicht (*-data.js) kommt ueber die normale Abholung mit
   in den Cache — sie hier zu nennen wuerde die Installation an ihr scheitern lassen,
   falls eine Instanz eine davon nicht hat. */
const GERUEST = [
  './',
  './index.html',
  './fonts.css',
  './compass-produkt.css',
  './compass-produkt.js',
  './compass-i18n.js',
  './compass-edit.js',
  './manifest.webmanifest',
  './app-icons/icon-192.png',
  './app-icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* Einzeln, nicht addAll: addAll bricht komplett ab, sobald EINE Datei fehlt —
       dann waere die App gar nicht installierbar, statt nur eine Datei aermer. */
    await Promise.all(GERUEST.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter(n => n.startsWith('compass-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   /* john-server, Schriften Dritter: durchlassen */

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
      /* Ein Seitenaufruf ohne Treffer landet auf der Startseite — besser als der
         Dinosaurier des Browsers, und die Seite sagt selbst, dass sie offline ist. */
      if (req.mode === 'navigate') {
        const start = await caches.match('./index.html', { ignoreSearch: true });
        if (start) return start;
      }
      throw err;
    }
  })());
});
