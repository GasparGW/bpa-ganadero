/**
 * Service worker de BPA Ganadero — hace real el "funciona sin señal" en la web:
 * tras la primera visita, la app y sus assets quedan cacheados y abren offline.
 *
 * Precache del shell en `install`: el SW se registra recién en 'load', cuando el navegador
 * YA bajó index + bundle + wasm + fuentes sin pasar por él, así que sin precache la cache
 * quedaría vacía y el PRIMER offline (una sola visita con señal) fallaría. En install se
 * lee `precache-manifest.json` (generado en build por scripts/gen-precache.mjs con la lista
 * hasheada real del dist) y se cachea el shell.
 *
 * SET CRÍTICO vs RESTO: index ('/'), el bundle JS de /_expo/ y el .wasm de sql.js son el
 * mínimo para que la app ABRA offline; se cachean de forma ATÓMICA y con reintento, y si
 * alguno no entra FALLAMOS el install (waitUntil rechaza) para que el navegador reintente:
 * nunca dejamos un SW "activo" que en el próximo offline sirva 503 sobre el bundle. Las
 * fuentes/íconos son best-effort (si falta una fuente, la app abre con tipografía de
 * sistema; no vale abortar el shell por eso). Se usa el modo de cache por defecto (no
 * 'reload'): los assets recién los bajó el navegador para renderizar, así que copiarlos a
 * Cache Storage desde el HTTP cache es instantáneo y no re-descarga ni satura la conexión.
 *
 * VERSIONADO: el nombre de cache lleva un hash del manifest (lo estampa gen-precache en el
 * dist). Cada redeploy con assets nuevos cambia el hash → cambia el nombre → el navegador
 * detecta un SW distinto → install re-precachea atómicamente en una cache NUEVA y `activate`
 * borra las viejas. Así un returning user siempre ve la versión vieja COMPLETA o la nueva
 * COMPLETA, nunca una mezcla index-nuevo/bundle-viejo que rompería offline.
 *
 * Estrategia de fetch (todo same-origin GET; nunca toca otros orígenes ni no-GET):
 *  - assets inmutables (hasheados en /_expo/…, /assets/… y el .wasm): cache-first.
 *  - navegación / demás: network-first. NO re-cacheamos navegaciones en runtime: el '/'
 *    cacheado lo posee el precache atómico del install (coherente con SU bundle), así un
 *    redeploy parcial no deja un index nuevo apuntando a un bundle que no está.
 */

const CACHE = 'bpa-ganadero-__VERSION__';

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch('/precache-manifest.json', { cache: 'reload' });
  if (!res.ok) throw new Error('precache-manifest no disponible');
  const rutas = await res.json();

  const esCritico = (u) =>
    u === '/' || (u.startsWith('/_expo/') && u.endsWith('.js')) || u.endsWith('.wasm');
  const criticos = rutas.filter(esCritico);
  const resto = rutas.filter((u) => !esCritico(u));

  // Crítico: atómico con reintento. Si algo del shell no entra tras los reintentos, esto
  // lanza y el install falla (el navegador lo reintenta en la próxima navegación).
  await Promise.all(criticos.map((u) => cachearCriticoConReintento(cache, u)));

  // Resto: best-effort, sin abortar el shell por una fuente que falle.
  await Promise.all(
    resto.map(async (u) => {
      try {
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r.clone());
      } catch {
        /* se cacheará en su primer fetch controlado con red */
      }
    }),
  );
}

async function cachearCriticoConReintento(cache, u, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      // Primer intento: cache HTTP por defecto (el asset ya está, copia instantánea).
      // Reintentos: 'reload' fuerza ir a la red por si el HTTP cache no lo tenía.
      const r = await fetch(u, i === 0 ? undefined : { cache: 'reload' });
      if (r.ok) {
        await cache.put(u, r.clone());
        return;
      }
    } catch {
      /* reintentamos */
    }
  }
  throw new Error(`shell crítico no cacheado: ${u}`);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const inmutable =
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.wasm');
  event.respondWith(inmutable ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Offline y sin copia: no hay respuesta posible. Devolvemos un 503 explícito en vez de
    // dejar que respondWith reciba un rechazo (que rinde igual pero ensucia la consola).
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // No re-cacheamos navegaciones: el '/' cacheado es propiedad del precache atómico y debe
    // seguir siendo coherente con el bundle que ese install cacheó. Sí cacheamos otros GET
    // no-inmutables que lleguen acá (hoy no hay ninguno en runtime).
    if (res.ok && req.mode !== 'navigate') await cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Sólo para navegaciones caemos al index cacheado (app shell). Para otros GET sin copia
    // devolvemos 503, en vez de servir HTML con content-type equivocado (p. ej. un favicon).
    if (req.mode === 'navigate') {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}
