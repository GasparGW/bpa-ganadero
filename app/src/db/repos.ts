/**
 * Repositorios sobre el SQLite local. SQL puro contra la interfaz SqlDriver.
 *
 * Convenciones (axiomas del spec):
 *  - El id y el timestamp (`ahora`, ISO) los provee el llamador (el "device"):
 *    UUIDs generados en cliente, reloj inyectable → repos deterministas y testeables.
 *  - Toda escritura marca `pendiente_sync = 1`: el chip de sync cuenta sobre eso.
 *  - `setRespuesta` es UPSERT (última respuesta gana dentro del device) mientras la
 *    evaluación está abierta. `cerrarEvaluacion` congela el score y la vuelve inmutable.
 */

import { calcularScore } from '../domain/scoring';
import type { Requisito, Respuestas, ResultadoScore } from '../domain/types';
import type { SqlDriver } from './driver';
import { ESQUEMA_SQL, ESQUEMA_VERSION } from './schema';

/**
 * Aplica el esquema (idempotente) y sella la versión en `pragma user_version`.
 * Falla ruidoso ante un downgrade (base más nueva que la app): en una app donde el
 * device es la fuente de verdad, abrir con un binario viejo corrompería en silencio.
 * El DDL usa CREATE ... IF NOT EXISTS; las migraciones incrementales (v2+) se agregan
 * acá comparando contra `actual`.
 */
export async function migrar(db: SqlDriver): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  const actual = fila?.user_version ?? 0;
  if (actual > ESQUEMA_VERSION) {
    throw new Error(
      `La base local (v${actual}) es más nueva que la app (v${ESQUEMA_VERSION}). Actualizá la app.`,
    );
  }
  await db.execAsync(ESQUEMA_SQL);
  await db.execAsync(`pragma user_version = ${ESQUEMA_VERSION}`);
}

/**
 * Corre `fn` dentro de una transacción (begin/commit, rollback ante error). Para
 * escrituras multi-fila que deben ser atómicas (p. ej. alta de establecimiento +
 * evaluación): o entran las dos, o ninguna.
 */
export async function enTransaccion<T>(db: SqlDriver, fn: () => Promise<T>): Promise<T> {
  await db.execAsync('begin');
  try {
    const r = await fn();
    await db.execAsync('commit');
    return r;
  } catch (e) {
    await db.execAsync('rollback');
    throw e;
  }
}

export interface NuevoEstablecimiento {
  readonly id: string;
  readonly tenantId: string;
  readonly nombre: string;
  readonly renspa?: string | null;
  readonly localidad?: string | null;
  readonly provincia?: string | null;
  readonly ahora: string;
}

export async function crearEstablecimiento(
  db: SqlDriver,
  e: NuevoEstablecimiento,
): Promise<void> {
  await db.runAsync(
    `insert into establecimiento
       (id, tenant_id, nombre, renspa, localidad, provincia, creado_en, actualizado_en, pendiente_sync)
     values (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      e.id,
      e.tenantId,
      e.nombre,
      e.renspa ?? null,
      e.localidad ?? null,
      e.provincia ?? null,
      e.ahora,
      e.ahora,
    ],
  );
}

export interface NuevaEvaluacion {
  readonly id: string;
  readonly tenantId: string;
  readonly establecimientoId: string;
  readonly instrumento: string;
  readonly version: string;
  /** 'completo' recorre los 320; 'express' el subset curado. Default 'completo'. */
  readonly modo?: 'completo' | 'express';
  readonly ahora: string;
}

export async function crearEvaluacion(db: SqlDriver, ev: NuevaEvaluacion): Promise<void> {
  await db.runAsync(
    `insert into evaluacion
       (id, tenant_id, establecimiento_id, instrumento, version, modo, estado,
        abierta_en, actualizado_en, pendiente_sync)
     values (?, ?, ?, ?, ?, ?, 'abierta', ?, ?, 1)`,
    [
      ev.id,
      ev.tenantId,
      ev.establecimientoId,
      ev.instrumento,
      ev.version,
      ev.modo ?? 'completo',
      ev.ahora,
      ev.ahora,
    ],
  );
}

export interface DatosRespuesta {
  readonly id: string;
  readonly tenantId: string;
  readonly evaluacionId: string;
  readonly requisitoCodigo: string;
  readonly estado: Respuestas[string];
  readonly observacion?: string | null;
  readonly ahora: string;
}

/**
 * Upsert de una respuesta. Si ya existe (misma evaluación + requisito) actualiza
 * estado/observación y la re-marca pendiente de sync, conservando el id original.
 * Rechaza escribir sobre una evaluación cerrada (inmutable).
 */
export async function setRespuesta(db: SqlDriver, r: DatosRespuesta): Promise<void> {
  const ev = await db.getFirstAsync<{ estado: string }>(
    `select estado from evaluacion where id = ?`,
    [r.evaluacionId],
  );
  if (ev === null) {
    throw new Error(`Evaluación inexistente: ${r.evaluacionId}`);
  }
  if (ev.estado === 'cerrada') {
    throw new Error(`La evaluación ${r.evaluacionId} está cerrada: no admite cambios`);
  }
  await db.runAsync(
    `insert into respuesta
       (id, tenant_id, evaluacion_id, requisito_codigo, estado, observacion, actualizado_en, pendiente_sync)
     values (?, ?, ?, ?, ?, ?, ?, 1)
     on conflict (evaluacion_id, requisito_codigo) do update set
       estado = excluded.estado,
       observacion = excluded.observacion,
       actualizado_en = excluded.actualizado_en,
       pendiente_sync = 1`,
    [
      r.id,
      r.tenantId,
      r.evaluacionId,
      r.requisitoCodigo,
      r.estado,
      r.observacion ?? null,
      r.ahora,
    ],
  );
}

/** Respuestas de una evaluación como mapa código → estado (lo que consume el scoring). */
export async function listarRespuestas(
  db: SqlDriver,
  evaluacionId: string,
): Promise<Respuestas> {
  const filas = await db.getAllAsync<{ requisito_codigo: string; estado: Respuestas[string] }>(
    `select requisito_codigo, estado from respuesta where evaluacion_id = ?`,
    [evaluacionId],
  );
  const mapa: Record<string, Respuestas[string]> = {};
  for (const f of filas) mapa[f.requisito_codigo] = f.estado;
  return mapa;
}

/**
 * Filas sin sincronizar asociadas a una evaluación: la propia evaluación, su
 * establecimiento y sus respuestas. El chip no debe decir "sincronizado" mientras el
 * establecimiento o la evaluación siguen en el outbox (axioma #3: el estado de sync
 * es siempre visible). Como en Sprint 1 no hay transporte, esto nunca llega a cero.
 */
export async function contarPendientes(
  db: SqlDriver,
  evaluacionId: string,
): Promise<number> {
  const fila = await db.getFirstAsync<{ n: number }>(
    `select
       (select count(*) from evaluacion e
          where e.id = ? and e.pendiente_sync = 1)
     + (select count(*) from establecimiento s
          where s.id = (select establecimiento_id from evaluacion where id = ?)
            and s.pendiente_sync = 1)
     + (select count(*) from respuesta r
          where r.evaluacion_id = ? and r.pendiente_sync = 1) as n`,
    [evaluacionId, evaluacionId, evaluacionId],
  );
  return fila?.n ?? 0;
}

export interface EvaluacionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly establecimiento_id: string;
  readonly instrumento: string;
  readonly version: string;
  readonly modo: 'completo' | 'express';
  readonly estado: 'abierta' | 'cerrada';
  readonly abierta_en: string;
  readonly cerrada_en: string | null;
  readonly puntos_obtenidos: number | null;
  readonly maximo_aplicable: number | null;
  readonly score_pct: number | null;
}

export async function getEvaluacion(
  db: SqlDriver,
  evaluacionId: string,
): Promise<EvaluacionRow | null> {
  return db.getFirstAsync<EvaluacionRow>(
    `select id, tenant_id, establecimiento_id, instrumento, version, modo, estado,
            abierta_en, cerrada_en, puntos_obtenidos, maximo_aplicable, score_pct
       from evaluacion where id = ?`,
    [evaluacionId],
  );
}

/**
 * Cierra la evaluación: calcula el score con el scoring canónico del cliente sobre
 * las respuestas guardadas, lo CONGELA en la fila y marca la evaluación cerrada e
 * inmutable. Idempotencia defensiva: rechaza cerrar una ya cerrada.
 */
export async function cerrarEvaluacion(
  db: SqlDriver,
  args: {
    readonly evaluacionId: string;
    readonly requisitosPorCodigo: ReadonlyMap<string, Requisito>;
    readonly ahora: string;
  },
): Promise<ResultadoScore> {
  const ev = await getEvaluacion(db, args.evaluacionId);
  if (ev === null) throw new Error(`Evaluación inexistente: ${args.evaluacionId}`);
  if (ev.estado === 'cerrada') {
    throw new Error(`La evaluación ${args.evaluacionId} ya está cerrada`);
  }

  const respuestas = await listarRespuestas(db, args.evaluacionId);
  const score = calcularScore(respuestas, args.requisitosPorCodigo);

  // El `and estado = 'abierta'` hace el congelamiento atómico a nivel DB (espejo del
  // `where ... and estado = 'abierta' returning *` del servidor): si otra vía cerró la
  // evaluación entremedio, el UPDATE no toca ninguna fila y lanzamos, en vez de
  // re-congelar el score sobre datos ya cerrados.
  const res = await db.runAsync(
    `update evaluacion set
       estado = 'cerrada',
       cerrada_en = ?,
       puntos_obtenidos = ?,
       maximo_aplicable = ?,
       score_pct = ?,
       actualizado_en = ?,
       pendiente_sync = 1
     where id = ? and estado = 'abierta'`,
    [
      args.ahora,
      score.puntos_obtenidos,
      score.maximo_aplicable,
      score.score_pct,
      args.ahora,
      args.evaluacionId,
    ],
  );
  if (res.changes !== 1) {
    throw new Error(`La evaluación ${args.evaluacionId} ya no estaba abierta al cerrar`);
  }
  return score;
}
