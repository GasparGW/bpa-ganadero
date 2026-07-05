/**
 * Adaptador de SqlDriver sobre node:sqlite — SOLO para tests (Node 24+).
 * Nunca se importa desde el bundle de la app (React Native no tiene node:sqlite):
 * lo consumen únicamente los *.test.ts, así los repos se ejercitan con SQL real.
 */

import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlValue } from '../driver';

export function nodeDriver(): { db: DatabaseSync; driver: SqlDriver } {
  const db = new DatabaseSync(':memory:');
  const driver: SqlDriver = {
    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[] = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
      const row = db.prepare(sql).get(...params);
      return (row ?? null) as T | null;
    },
  };
  return { db, driver };
}
