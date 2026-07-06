/**
 * Creación del driver — variante NATIVA (iOS/Android), sobre expo-sqlite.
 *
 * Metro resuelve este archivo en native y `abrir.web.ts` en web (extensión de
 * plataforma). Así el bundle web NUNCA importa expo-sqlite (cuya build web arrastra
 * un wasm que rompe el empaquetado). Cada variante sólo CREA el driver; el cacheo y
 * las migraciones viven en `index.ts` (compartido).
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { RunResult, SqlDriver, SqlValue } from './driver';

/** Adapta el SQLiteDatabase de expo-sqlite a nuestra interfaz SqlDriver. */
function expoDriver(db: SQLiteDatabase): SqlDriver {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params = []): Promise<RunResult> => db.runAsync(sql, params as SqlValue[]),
    getAllAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
  };
}

export async function crearDriver(): Promise<SqlDriver> {
  const db = await openDatabaseAsync('bpa-ganadero.db');
  return expoDriver(db);
}
