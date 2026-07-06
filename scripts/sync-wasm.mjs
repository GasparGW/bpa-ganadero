/**
 * Sincroniza el WASM de sql.js a app/public/ desde node_modules.
 *
 * Por qué existe: el driver web sirve el .wasm desde la raíz del sitio (locateFile →
 * `/sql-wasm-browser.wasm`), y expo export copia public/ al output. Ese archivo NO se
 * puede dejar copiado a mano y commiteado: con un bump de sql.js el binario cambia y el
 * public/ quedaría stale sirviendo un wasm viejo a un glue nuevo. Este script lo copia
 * desde node_modules (fuente de verdad) y borra variantes que el glue no pide.
 *
 * El glue que Metro bundlea (sql-wasm-browser.js) pide EXCLUSIVAMENTE
 * `sql-wasm-browser.wasm` (verificado por grep del bundle: 0 ocurrencias de
 * `sql-wasm.wasm`). Corré `npm run sync:wasm` antes de `expo export --platform web`.
 */
import { copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const publico = join(app, 'public');
const origen = join(app, 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');

if (!existsSync(origen)) {
  console.error(`[sync-wasm] no existe ${origen} — ¿instalaste sql.js?`);
  process.exit(1);
}

mkdirSync(publico, { recursive: true });
copyFileSync(origen, join(publico, 'sql-wasm-browser.wasm'));

// Peso muerto: el glue nunca lo pide. Si quedó de una copia manual previa, lo sacamos.
const muerto = join(publico, 'sql-wasm.wasm');
if (existsSync(muerto)) rmSync(muerto);

console.log('[sync-wasm] public/sql-wasm-browser.wasm actualizado desde node_modules');
