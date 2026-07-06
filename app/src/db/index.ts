/**
 * Apertura del SQLite local y su exposición como SqlDriver a la app.
 *
 * La creación del driver es lo único que depende de la plataforma y vive en `./abrir`
 * (Metro resuelve `abrir.ts` en native = expo-sqlite, `abrir.web.ts` en web = sql.js).
 * Acá quedan el cacheo idempotente, las migraciones y el contexto de React — idénticos
 * en todos los targets. El gate de carga (mientras abre) lo maneja App.tsx.
 */

import { createContext, useContext } from 'react';

import { crearDriver } from './abrir';
import type { SqlDriver } from './driver';
import { migrar } from './repos';

// Cacheamos la PROMESA, no el driver resuelto: si `abrirBase` se llama dos veces
// antes de que la primera termine (StrictMode monta/desmonta, o dos consumidores en
// paralelo), ambas esperan la misma apertura+migración en vez de abrir/migrar dos veces.
let cache: Promise<SqlDriver> | null = null;

export function abrirBase(): Promise<SqlDriver> {
  if (cache === null) {
    cache = (async () => {
      const driver = await crearDriver();
      await migrar(driver);
      return driver;
    })();
  }
  return cache;
}

export const DbContext = createContext<SqlDriver | null>(null);

export function useDb(): SqlDriver {
  const db = useContext(DbContext);
  if (db === null) throw new Error('useDb() usado fuera de <DbContext.Provider>');
  return db;
}
