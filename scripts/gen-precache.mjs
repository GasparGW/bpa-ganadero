/**
 * Genera el manifest de precache del service worker: lista TODO el shell de la app en
 * app/dist para que el SW lo cachee en `install`. Corre DESPUÉS de `expo export` (necesita
 * el dist ya generado con los nombres hasheados) y escribe `dist/precache-manifest.json`.
 *
 * Por qué existe: el SW se registra recién en 'load', cuando el navegador ya bajó los
 * assets sin pasar por él, así que sin un precache explícito la primera visita no deja nada
 * cacheado y el primer offline falla. Los nombres son hasheados (no se pueden hardcodear),
 * y las fuentes las pide el bundle en runtime (no aparecen en index.html), así que hay que
 * derivar la lista del dist real. Enfoque estándar (equivalente a lo que hace Workbox).
 *
 * Incluye: '/' (index), todo `/_expo/…` (bundle+css), todo `/assets/…` (fuentes, íconos) y
 * el `.wasm` de sql.js en la raíz. Excluye sourcemaps, metadata y el propio manifest/sw.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'app', 'dist');

function listar(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const abs = join(dir, nombre);
    if (statSync(abs).isDirectory()) salida.push(...listar(abs));
    else salida.push(abs);
  }
  return salida;
}

const EXCLUIR = new Set(['sw.js', 'precache-manifest.json', 'metadata.json', 'favicon.ico']);

const rutas = new Set(['/']); // el index se cachea como '/'
for (const abs of listar(dist)) {
  const rel = relative(dist, abs).split('\\').join('/');
  const base = rel.split('/').pop();
  if (EXCLUIR.has(base) || rel === 'index.html' || rel.endsWith('.map')) continue;
  const enShell =
    rel.startsWith('_expo/') || rel.startsWith('assets/') || rel.endsWith('.wasm');
  if (enShell) rutas.add('/' + rel);
}

const manifest = [...rutas].sort();
const manifestJson = JSON.stringify(manifest);
writeFileSync(join(dist, 'precache-manifest.json'), manifestJson);

// Estampa una versión (hash del manifest) en el nombre de cache del SW. Como los assets van
// hasheados en la ruta, el manifest cambia cuando cambia cualquier asset → cambia el hash →
// el sw.js desplegado cambia de bytes → el navegador detecta un SW nuevo y re-precachea en
// una cache nueva (redeploy atómico). Determinístico: mismo dist ⇒ misma versión.
const version = createHash('sha256').update(manifestJson).digest('hex').slice(0, 12);
const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
if (!sw.includes('__VERSION__')) {
  throw new Error('[gen-precache] sw.js no tiene el placeholder __VERSION__ para estampar');
}
writeFileSync(swPath, sw.split('__VERSION__').join(version));

console.log(`[gen-precache] ${manifest.length} rutas · cache bpa-ganadero-${version}`);
