/**
 * Interfaz mínima de acceso a SQLite. En device la satisface el `SQLiteDatabase`
 * de expo-sqlite (ver db/index.ts); en tests, un adaptador sobre `node:sqlite`.
 * Los repositorios dependen SOLO de esta interfaz: la lógica de datos se testea
 * con SQL real sin arrancar React Native.
 *
 * El contrato de parámetros es posicional (`?` + array), común a expo-sqlite y
 * node:sqlite — así el mismo SQL de repos.ts corre idéntico en ambos.
 */

export type SqlValue = string | number | null;

export interface RunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

export interface SqlDriver {
  /** Ejecuta uno o más statements sin parámetros (DDL, PRAGMA). */
  execAsync(sql: string): Promise<void>;
  /** Ejecuta una escritura parametrizada. */
  runAsync(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Devuelve todas las filas de una consulta. */
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Devuelve la primera fila o `null`. */
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}
