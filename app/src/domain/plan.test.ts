import { describe, expect, it } from 'vitest';

import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import { analizarGaps } from './gaps';
import { indexarGuia, type GuiaRequisito, type NivelEsfuerzo } from './guia';
import { construirPlan } from './plan';
import type { Respuestas } from './types';

const np1 = REQUISITOS.filter((r) => r.np === 1);
const np2 = REQUISITOS.filter((r) => r.np === 2);

/** Fixture de guía. `curada` trae pasos + cita a ítem; `derivada` no inventa nada. */
function guia(
  codigo: string,
  nivel_esfuerzo: NivelEsfuerzo | null,
  estado: 'curada' | 'derivada' = 'curada',
): GuiaRequisito {
  const curada = estado === 'curada';
  return {
    codigo,
    estado,
    como_implementar: curada ? [`resolver ${codigo}`] : [],
    evidencia_sugerida: curada ? 'registro o foto' : null,
    cita: { seccion: 'Sección X', item: curada ? '1.1' : null },
    nivel_esfuerzo,
  };
}

const codigos = (p: { items: readonly { gap: { codigo: string } }[] }): string[] =>
  p.items.map((i) => i.gap.codigo);

describe('construirPlan — orden total (NP → esfuerzo → orden_global)', () => {
  it('dentro del mismo NP, el esfuerzo manda sobre orden_global', () => {
    // np1[0] tiene orden_global MENOR que np1[1]. Si sólo mandara orden_global,
    // np1[0] iría primero. Pero le damos esfuerzo alto y a np1[1] esfuerzo bajo:
    // la "ganancia rápida" (bajo) debe salir primero pese a su orden_global mayor.
    const [a, b] = np1;
    const respuestas: Respuestas = { [a.codigo]: 'NI', [b.codigo]: 'NI' };
    const g = indexarGuia([guia(a.codigo, 'alto'), guia(b.codigo, 'bajo')]);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, g);
    expect(codigos(plan)).toEqual([b.codigo, a.codigo]);
  });

  it('el NP manda sobre el esfuerzo (un NP1-alto va antes que un NP2-bajo)', () => {
    const a = np1[0];
    const b = np2[0];
    const respuestas: Respuestas = { [a.codigo]: 'NI', [b.codigo]: 'NI' };
    const g = indexarGuia([guia(a.codigo, 'alto'), guia(b.codigo, 'bajo')]);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, g);
    expect(codigos(plan)).toEqual([a.codigo, b.codigo]);
  });

  it('con mismo NP y mismo esfuerzo, desempata por orden_global ascendente', () => {
    // Insertados en orden_global DESCENDENTE: el resultado debe salir ascendente.
    const [a, b] = np1;
    const respuestas: Respuestas = { [b.codigo]: 'NI', [a.codigo]: 'NI' };
    const g = indexarGuia([guia(a.codigo, 'medio'), guia(b.codigo, 'medio')]);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, g);
    const esperado = [a, b].sort((x, y) => x.orden_global - y.orden_global).map((r) => r.codigo);
    expect(codigos(plan)).toEqual(esperado);
  });

  it('un gap sin esfuerzo estimado ordena DESPUÉS de uno alto (no salta al frente)', () => {
    const [a, b] = np1;
    const respuestas: Respuestas = { [a.codigo]: 'NI', [b.codigo]: 'NI' };
    // a: sin entrada de guía (esfuerzo desconocido). b: alto. b debe ir primero.
    const g = indexarGuia([guia(b.codigo, 'alto')]);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, g);
    expect(codigos(plan)).toEqual([b.codigo, a.codigo]);
    expect(plan.items[1].guia).toBeNull();
  });
});

describe('construirPlan — cuantificación y contenido', () => {
  it('reusa los números de analizarGaps (misma aritmética canónica)', () => {
    const respuestas: Respuestas = {
      [np1[0].codigo]: 'NI',
      [np1[1].codigo]: 'IT',
      [np2[0].codigo]: 'NI',
    };
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, indexarGuia([]));
    const a = analizarGaps(respuestas, INDICE_REQUISITOS);
    expect(plan.score_actual).toBe(a.score_actual);
    expect(plan.score_potencial).toBe(a.score_potencial);
    expect(plan.np1_ni).toBe(a.np1_ni);
    expect(plan.total_gaps).toBe(a.gaps.length);
  });

  it('sólo incluye los NI (lo NA y lo implementado no aparece en el plan)', () => {
    const respuestas: Respuestas = {
      [np1[0].codigo]: 'NI',
      [np1[1].codigo]: 'NA',
      [np1[2].codigo]: 'IT',
      [np1[3].codigo]: 'IP',
    };
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, indexarGuia([]));
    expect(codigos(plan)).toEqual([np1[0].codigo]);
  });

  it('una entrada derivada no aporta pasos inventados (el motor no fabrica)', () => {
    const a = np1[0];
    const respuestas: Respuestas = { [a.codigo]: 'NI' };
    const g = indexarGuia([guia(a.codigo, null, 'derivada')]);
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, g);
    expect(plan.items[0].guia?.estado).toBe('derivada');
    expect(plan.items[0].guia?.como_implementar).toEqual([]);
    expect(plan.items[0].guia?.cita.item).toBeNull();
  });
});

describe('construirPlan — agrupado por categoría', () => {
  const perNp1 = REQUISITOS.find((r) => r.categoria_codigo === 'PER' && r.np === 1)!;

  it('agrupa por categoría, ordenadas por orden_global mínimo, con su score', () => {
    const respuestas: Respuestas = {
      [np1[0].codigo]: 'NI', // ORG (orden_global menor)
      [perNp1.codigo]: 'NI', // PER (orden_global mayor)
    };
    const plan = construirPlan(respuestas, INDICE_REQUISITOS, indexarGuia([]));
    expect(plan.categorias.map((c) => c.codigo)).toEqual(['ORG', 'PER']);
    // El score de cada grupo coincide con el score de su subconjunto (ambos NI ⇒ 0%).
    for (const c of plan.categorias) {
      const propias = c.codigo === 'ORG' ? { [np1[0].codigo]: 'NI' } : { [perNp1.codigo]: 'NI' };
      expect(c.score_pct).toBe(analizarGaps(propias as Respuestas, INDICE_REQUISITOS).score_actual);
    }
    // La suma de ítems agrupados es la del plan plano, sin perder ni duplicar.
    const enGrupos = plan.categorias.flatMap((c) => c.items.map((i) => i.gap.codigo)).sort();
    expect(enGrupos).toEqual(codigos(plan).sort());
  });
});
