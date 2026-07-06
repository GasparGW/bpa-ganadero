import { beforeEach, describe, expect, it } from 'vitest';

import { construirPlan } from '../domain/plan';
import { INDICE_GUIA } from '../guia';
import { INDICE_REQUISITOS } from '../instrumento';
import type { SqlDriver } from './driver';
import * as repos from './repos';
import { cargarCasoDemo } from './seed';
import { nodeDriver } from './testing/node-driver';

const AHORA = '2026-07-05T12:00:00.000Z';

let db: SqlDriver;
beforeEach(async () => {
  db = nodeDriver().driver;
  await repos.migrar(db);
});

describe('caso piloto sembrado (cargarCasoDemo)', () => {
  it('siembra una evaluación express CERRADA con score congelado', async () => {
    const caso = await cargarCasoDemo(db, AHORA);
    const ev = await repos.getEvaluacion(db, caso.evaluacionId);
    expect(ev).not.toBeNull();
    expect(ev!.modo).toBe('express');
    expect(ev!.estado).toBe('cerrada');
    expect(ev!.cerrada_en).toBe(AHORA);
    expect(ev!.score_pct, 'el score quedó congelado').not.toBeNull();
  });

  it('guarda las 15 respuestas del subset express (7 IT, 3 IP, 5 NI)', async () => {
    const caso = await cargarCasoDemo(db, AHORA);
    const respuestas = await repos.listarRespuestas(db, caso.evaluacionId);
    const valores = Object.values(respuestas);
    expect(valores).toHaveLength(15);
    expect(valores.filter((e) => e === 'IT')).toHaveLength(7);
    expect(valores.filter((e) => e === 'IP')).toHaveLength(3);
    expect(valores.filter((e) => e === 'NI')).toHaveLength(5);
  });

  it('produce un plan de 5 esenciales en 5 categorías, todos con guía curada', async () => {
    const caso = await cargarCasoDemo(db, AHORA);
    const respuestas = await repos.listarRespuestas(db, caso.evaluacionId);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, INDICE_GUIA);
    expect(plan.total_gaps).toBe(5);
    expect(plan.np1_ni).toBe(5);
    expect(plan.categorias).toHaveLength(5);
    for (const item of plan.items) {
      expect(item.guia, `${item.gap.codigo} sin guía en el plan del caso demo`).not.toBeNull();
      expect(item.guia!.estado).toBe('curada');
    }
  });

  it('es idempotente: sembrar dos veces no duplica ni cambia el id', async () => {
    const a = await cargarCasoDemo(db, AHORA);
    const b = await cargarCasoDemo(db, '2026-07-06T09:00:00.000Z');
    expect(b.evaluacionId).toBe(a.evaluacionId);
    const establecimientos = await db.getAllAsync<{ n: number }>(
      'select count(*) as n from establecimiento',
    );
    expect(establecimientos[0].n).toBe(1);
    const respuestas = await repos.listarRespuestas(db, a.evaluacionId);
    expect(Object.keys(respuestas)).toHaveLength(15);
  });
});
