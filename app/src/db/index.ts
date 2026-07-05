/**
 * Apertura del SQLite local (expo-sqlite) y su exposición como SqlDriver a la app.
 *
 * La misma interfaz que testeamos con node:sqlite se satisface en device con el
 * SQLiteDatabase de expo. `abrirBase` es idempotente (cachea la instancia) y corre
 * las migraciones al abrir. El contexto de React entrega el driver ya abierto; el
 * gate de carga (mientras abre) lo maneja App.tsx junto con las fuentes.
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext } from 'react';

import type { RunResult, SqlDriver, SqlValue } from './driver';
import { migrar } from './repos';

/** Adapta el SQLiteDatabase de expo-sqlite a nuestra interfaz SqlDriver. */
function expoDriver(db: SQLiteDatabase): SqlDriver {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params = []): Promise<RunResult> => db.runAsync(sql, params as SqlValue[]),
    getAllAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
  };
}

let cache: SqlDriver | null = null;

export async function abrirBase(): Promise<SqlDriver> {
  if (cache) return cache;
  const db = await openDatabaseAsync('bpa-ganadero.db');
  const driver = expoDriver(db);
  await migrar(driver);
  cache = driver;
  return driver;
}

export const DbContext = createContext<SqlDriver | null>(null);

export function useDb(): SqlDriver {
  const db = useContext(DbContext);
  if (db === null) throw new Error('useDb() usado fuera de <DbContext.Provider>');
  return db;
}
