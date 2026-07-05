import { beforeEach, describe, expect, it } from 'vitest';

import { calcularScore } from '../domain/scoring';
import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import type { SqlDriver } from './driver';
import * as repos from './repos';
import { nodeDriver } from './testing/node-driver';

const T = '11111111-1111-1111-1111-111111111111';
const EST = '22222222-2222-2222-2222-222222222222';
const EVAL = '33333333-3333-3333-3333-333333333333';

/** Reloj determinista para los tests. */
function iso(seg: number): string {
  return `2026-07-05T12:00:${String(seg).padStart(2, '0')}.000Z`;
}

const np1 = REQUISITOS.filter((r) => r.np === 1);

let db: SqlDriver;
beforeEach(async () => {
  db = nodeDriver().driver;
  await repos.migrar(db);
  await repos.crearEstablecimiento(db, { id: EST, tenantId: T, nombre: 'La Matilde', ahora: iso(0) });
  await repos.crearEvaluacion(db, {
    id: EVAL,
    tenantId: T,
    establecimientoId: EST,
    instrumento: 'BPG-VC',
    version: '2026.07',
    ahora: iso(1),
  });
});

describe('repositorios SQLite (SQL real vía node:sqlite)', () => {
  it('crea la evaluación abierta', async () => {
    const ev = await repos.getEvaluacion(db, EVAL);
    expect(ev?.estado).toBe('abierta');
    expect(ev?.cerrada_en).toBeNull();
    expect(ev?.score_pct).toBeNull();
  });

  it('guarda respuestas y las lista como mapa código → estado', async () => {
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'IT', ahora: iso(2) });
    await repos.setRespuesta(db, { id: 'r2', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[1].codigo, estado: 'NI', ahora: iso(3) });

    const mapa = await repos.listarRespuestas(db, EVAL);
    expect(mapa[np1[0].codigo]).toBe('IT');
    expect(mapa[np1[1].codigo]).toBe('NI');
    // 2 respuestas + el establecimiento + la evaluación, todos pendientes de sync.
    expect(await repos.contarPendientes(db, EVAL)).toBe(4);
  });

  it('contarPendientes incluye establecimiento y evaluación, no solo respuestas', async () => {
    // Recién creados, sin ninguna respuesta: el chip NO debe decir "sincronizado".
    expect(await repos.contarPendientes(db, EVAL)).toBe(2);
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'IT', ahora: iso(2) });
    expect(await repos.contarPendientes(db, EVAL)).toBe(3);
  });

  it('la FK rechaza una respuesta huérfana (evaluación inexistente)', async () => {
    await expect(
      db.runAsync(
        `insert into respuesta (id, tenant_id, evaluacion_id, requisito_codigo, estado, actualizado_en, pendiente_sync)
         values (?, ?, ?, ?, ?, ?, 1)`,
        ['huerfana', T, 'no-existe', np1[0].codigo, 'IT', iso(2)],
      ),
    ).rejects.toThrow();
  });

  it('upsert: reescribir el mismo requisito actualiza, no duplica', async () => {
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'NI', ahora: iso(2) });
    await repos.setRespuesta(db, { id: 'r1b', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'IT', ahora: iso(4) });

    const mapa = await repos.listarRespuestas(db, EVAL);
    expect(mapa[np1[0].codigo]).toBe('IT');
    const fila = await db.getFirstAsync<{ n: number }>('select count(*) as n from respuesta where evaluacion_id = ?', [EVAL]);
    expect(fila?.n).toBe(1);
  });

  it('cerrar congela el score y lo deja inmutable', async () => {
    // Dos NP1 (peso 10 c/u): IT + NI ⇒ 10/20 = 50,00 %.
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'IT', ahora: iso(2) });
    await repos.setRespuesta(db, { id: 'r2', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[1].codigo, estado: 'NI', ahora: iso(3) });

    const score = await repos.cerrarEvaluacion(db, { evaluacionId: EVAL, requisitosPorCodigo: INDICE_REQUISITOS, ahora: iso(5) });
    expect(score).toEqual({ puntos_obtenidos: 10, maximo_aplicable: 20, score_pct: 50 });

    // El score congelado en la fila coincide con el scoring canónico del cliente.
    const ev = await repos.getEvaluacion(db, EVAL);
    const esperado = calcularScore(await repos.listarRespuestas(db, EVAL), INDICE_REQUISITOS);
    expect(ev?.estado).toBe('cerrada');
    expect(ev?.cerrada_en).toBe(iso(5));
    expect(ev?.score_pct).toBe(esperado.score_pct);
  });

  it('una evaluación cerrada no admite más respuestas ni recierre', async () => {
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'IT', ahora: iso(2) });
    await repos.cerrarEvaluacion(db, { evaluacionId: EVAL, requisitosPorCodigo: INDICE_REQUISITOS, ahora: iso(5) });

    await expect(
      repos.setRespuesta(db, { id: 'r2', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[1].codigo, estado: 'IT', ahora: iso(6) }),
    ).rejects.toThrow(/cerrada/);
    await expect(
      repos.cerrarEvaluacion(db, { evaluacionId: EVAL, requisitosPorCodigo: INDICE_REQUISITOS, ahora: iso(7) }),
    ).rejects.toThrow(/ya está cerrada/);
  });

  it('todo-NA se puede cerrar con score_pct nulo (espejo del servidor)', async () => {
    await repos.setRespuesta(db, { id: 'r1', tenantId: T, evaluacionId: EVAL, requisitoCodigo: np1[0].codigo, estado: 'NA', ahora: iso(2) });
    const score = await repos.cerrarEvaluacion(db, { evaluacionId: EVAL, requisitosPorCodigo: INDICE_REQUISITOS, ahora: iso(5) });
    expect(score.score_pct).toBeNull();
    const ev = await repos.getEvaluacion(db, EVAL);
    expect(ev?.estado).toBe('cerrada');
    expect(ev?.score_pct).toBeNull();
  });
});
