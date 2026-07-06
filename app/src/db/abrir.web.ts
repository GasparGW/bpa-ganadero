/**
 * Creación del driver — variante WEB, sobre sql.js (SQLite compilado a WASM).
 *
 * Metro resuelve este archivo en web (extensión de plataforma) en lugar de `abrir.ts`.
 * Es SQLite de verdad en el navegador: corre el MISMO SQL y las mismas migraciones que
 * el driver nativo, así que los repos y el dominio son idénticos en todos los targets.
 *
 * Persistencia: la base se serializa (`db.export()`) y se guarda en IndexedDB tras cada
 * escritura, y se restaura al arrancar. Así el axioma "cero pérdida silenciosa" también
 * vale en web: un reload accidental (o cerrar y volver) no borra la evaluación en curso.
 * No usa OPFS ni SharedArrayBuffer, así que NO necesita headers COOP/COEP. Si IndexedDB
 * no está disponible (p. ej. incógnito estricto), degrada a efímero sin romper. El glue
 * de sql.js pide `sql-wasm-browser.wasm`, servido desde la raíz del sitio (sincronizado
 * desde node_modules por `scripts/sync-wasm.mjs` y copiado al output por expo export).
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import type { RunResult, SqlDriver, SqlValue } from './driver';

let motor: SqlJsStatic | null = null;

/** Carga el runtime WASM una sola vez (cacheado a nivel módulo). */
async function cargarMotor(): Promise<SqlJsStatic> {
  if (motor !== null) return motor;
  motor = await initSqlJs({ locateFile: (archivo) => `/${archivo}` });
  return motor;
}

// --- Persistencia en IndexedDB (clave única: el snapshot completo de la base) ---
const IDB_NOMBRE = 'bpa-ganadero';
const IDB_STORE = 'sqlite';
const IDB_CLAVE = 'db';

function abrirIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOMBRE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Lee el snapshot guardado. Devuelve null si no hay o si IndexedDB no está disponible. */
async function cargarSnapshot(): Promise<Uint8Array | null> {
  try {
    const idb = await abrirIdb();
    try {
      return await new Promise<Uint8Array | null>((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_CLAVE);
        req.onsuccess = () => {
          const v = req.result as Uint8Array | ArrayBuffer | undefined;
          if (v == null) resolve(null);
          else resolve(v instanceof Uint8Array ? v : new Uint8Array(v));
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      idb.close();
    }
  } catch {
    return null; // sin IndexedDB → sesión efímera, no romper el arranque
  }
}

async function guardarSnapshot(bytes: Uint8Array): Promise<void> {
  const idb = await abrirIdb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_CLAVE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    idb.close();
  }
}

/**
 * Guardador consciente de transacciones. Serializa la base (`db.export()`) sólo cuando NO
 * hay una transacción abierta: exportar a mitad de un BEGIN…COMMIT rompe sql.js, así que
 * el guardado se DIFIERE hasta el commit (o rollback). Coalescente: marca "sucio" y un
 * único bucle en vuelo re-exporta hasta drenar, garantizando que el ÚLTIMO estado siempre
 * se persiste, sin transacciones IndexedDB solapadas ni perder la escritura final.
 */
interface Guardador {
  entrarTx(): void;
  salirTx(): void;
  marcarSucio(): void;
}

function crearGuardador(db: Database): Guardador {
  let profundidadTx = 0;
  let sucio = false;
  let enVuelo: Promise<void> | null = null;

  const drenar = (): void => {
    if (profundidadTx > 0 || enVuelo !== null) return; // en tx: esperar al commit
    enVuelo = (async () => {
      // `profundidadTx === 0` se re-chequea cada vuelta; `db.export()` se invoca sin await
      // de por medio tras el chequeo, así que nunca corre con una transacción abierta.
      while (sucio && profundidadTx === 0) {
        sucio = false;
        try {
          // slice() copia a un buffer de tamaño exacto (export() puede sobredimensionar).
          const bytes = db.export().slice();
          // `export()` en sql.js CIERRA y REABRE la conexión (sqlite3_close_v2 + sqlite3_open,
          // no serializa): la conexión reabierta pierde los pragmas de conexión. Reponemos
          // foreign_keys=ON, o quedaría OFF el resto de la sesión y las FK no se aplicarían
          // (violación silenciosa de integridad — el axioma "cero pérdida silenciosa" la prohíbe).
          db.exec('pragma foreign_keys = on');
          await guardarSnapshot(bytes);
        } catch {
          // Falla de persistencia = degradación silenciosa a efímero para ESTA escritura;
          // la base en memoria sigue siendo la fuente de verdad de la sesión.
        }
      }
      enVuelo = null;
    })();
  };

  return {
    entrarTx() {
      profundidadTx += 1;
    },
    salirTx() {
      profundidadTx = Math.max(0, profundidadTx - 1);
      if (profundidadTx === 0) drenar();
    },
    marcarSucio() {
      sucio = true;
      drenar();
    },
  };
}

function webDriver(db: Database): SqlDriver {
  const guardador = crearGuardador(db);
  return {
    // DDL / multi-statement (migraciones y control de transacción). BEGIN/COMMIT/ROLLBACK
    // ajustan la profundidad para diferir el guardado hasta cerrar la transacción.
    async execAsync(sql: string): Promise<void> {
      const s = sql.trim().toLowerCase();
      if (s.startsWith('begin')) {
        db.exec(sql);
        guardador.entrarTx();
        return;
      }
      if (s.startsWith('commit') || s.startsWith('rollback')) {
        // salirTx() en `finally`: si el COMMIT/ROLLBACK tira (p. ej. un ROLLBACK sobre una tx
        // ya auto-cancelada por un error → "no transaction is active"), igual bajamos la
        // profundidad. Sin esto, profundidadTx quedaba clavado en 1 y `drenar` no volvía a
        // exportar nunca: toda la sesión posterior se perdía en silencio al recargar.
        try {
          db.exec(sql);
        } finally {
          guardador.salirTx();
        }
        return;
      }
      db.exec(sql);
      guardador.marcarSucio();
    },
    // Una sentencia parametrizada. Sólo `changes` tiene consumidor real
    // (cerrarEvaluacion chequea changes === 1). El esquema usa PK TEXT (UUID de
    // cliente), así que `lastInsertRowId` no lo lee nadie: devolvemos 0 en vez de
    // correr un `SELECT last_insert_rowid()` por cada escritura (rowid basura).
    async runAsync(sql: string, params: SqlValue[] = []): Promise<RunResult> {
      db.run(sql, params);
      // `getRowsModified()` ANTES de `marcarSucio()`: fuera de transacción, marcarSucio
      // dispara `db.export()` de forma síncrona, y exportar resetea el contador de filas
      // modificadas de SQLite. Leerlo después devolvía 0 y rompía el `changes === 1` de
      // cerrarEvaluacion (falso "ya no estaba abierta"). Se lee acá y recién después se marca.
      const changes = db.getRowsModified();
      guardador.marcarSucio();
      return { changes, lastInsertRowId: 0 };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const filas: T[] = [];
        while (stmt.step()) filas.push(stmt.getAsObject() as T);
        return filas;
      } finally {
        stmt.free();
      }
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        return stmt.step() ? (stmt.getAsObject() as T) : null;
      } finally {
        stmt.free();
      }
    },
  };
}

export async function crearDriver(): Promise<SqlDriver> {
  const sql = await cargarMotor();
  const snapshot = await cargarSnapshot();
  const db = snapshot !== null ? new sql.Database(snapshot) : new sql.Database();
  // Conexión nueva: sql.js arranca con foreign_keys OFF. Lo activamos ya, antes de que corran
  // las migraciones o cualquier lectura, para que la integridad referencial rija desde el
  // primer statement (en un boot con snapshot restaurado, migrar puede saltear el esquema).
  db.exec('pragma foreign_keys = on');
  return webDriver(db);
}
