/**
 * Plan de acción: el análisis de gaps (qué falta) enriquecido con la guía (cómo
 * resolverlo), ordenado por prioridad y agrupado por categoría. Es el eslabón entre
 * el resultado y la acción concreta del productor.
 *
 * Puro y DETERMINÍSTICO (axioma del proyecto). El orden es una clave TOTAL —
 * `NP → esfuerzo → orden_global` — sin empates sin resolver:
 *   - NP: única doctrina de orden real (la guía deja el orden a criterio del productor;
 *     ver guia_general_bpg_vc.txt:74,99). El "impacto" al score ≡ NP exactamente, porque
 *     el denominador se cancela: ΔScore_i/ΔScore_j = peso_i/peso_j.
 *   - esfuerzo: estimación EDITORIAL nuestra (no doctrina) — "ganancia rápida" primero.
 *   - orden_global: desempate final, el mismo criterio estable que usa gaps.ts.
 *
 * v1 NO incluye secuenciación por doctrina ni prerrequisitos entre requisitos: la guía
 * casi no los enuncia, inferirlos sería heurística frágil. Diferido a v2.
 */

import { analizarGaps, type Gap } from './gaps';
import { rangoEsfuerzo, type GuiaRequisito } from './guia';
import { calcularScorePorCategoria } from './scoring';
import type { Requisito, Respuestas } from './types';

/** Un ítem del plan: un gap con su contenido de guía (o `null` si aún no bundleado). */
export interface PlanItem {
  readonly gap: Gap;
  readonly guia: GuiaRequisito | null;
}

/** Un grupo del plan por categoría, con el score de esa categoría. */
export interface PlanCategoria {
  readonly codigo: string;
  readonly nombre: string;
  /** Score de la categoría (%). `null` si no tiene requisitos puntuables. */
  readonly score_pct: number | null;
  readonly items: readonly PlanItem[];
}

export interface Plan {
  readonly score_actual: number | null;
  readonly score_potencial: number | null;
  readonly np1_ni: number;
  readonly total_gaps: number;
  /** Todos los ítems en orden total plano (NP → esfuerzo → orden_global). */
  readonly items: readonly PlanItem[];
  /** Los mismos ítems agrupados por categoría (orden por orden_global mínimo). */
  readonly categorias: readonly PlanCategoria[];
}

/**
 * Construye el plan de acción de una evaluación.
 *
 * @param guiaPorCodigo índice código → guía (inyectado: mantiene el motor puro y
 *        testeable sin el bundle real). Un gap sin entrada de guía sale con `guia: null`.
 * @throws (vía analizarGaps → calcularScore) ante estado inválido o código desconocido.
 */
export function construirPlan(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
  guiaPorCodigo: ReadonlyMap<string, GuiaRequisito>,
): Plan {
  const analisis = analizarGaps(respuestas, requisitosPorCodigo);

  const items: PlanItem[] = analisis.gaps.map((gap) => ({
    gap,
    guia: guiaPorCodigo.get(gap.codigo) ?? null,
  }));

  // Clave TOTAL de orden. NP y orden_global vienen del gap; el esfuerzo, de la guía
  // (sin guía → sin estimar → rango máximo, ordena al final dentro de su NP).
  items.sort((a, b) => {
    if (a.gap.np !== b.gap.np) return a.gap.np - b.gap.np;
    const ea = rangoEsfuerzo(a.guia?.nivel_esfuerzo ?? null);
    const eb = rangoEsfuerzo(b.guia?.nivel_esfuerzo ?? null);
    if (ea !== eb) return ea - eb;
    return ordenGlobalDe(a, requisitosPorCodigo) - ordenGlobalDe(b, requisitosPorCodigo);
  });

  return {
    score_actual: analisis.score_actual,
    score_potencial: analisis.score_potencial,
    np1_ni: analisis.np1_ni,
    total_gaps: items.length,
    items,
    categorias: agruparPorCategoria(items, respuestas, requisitosPorCodigo),
  };
}

function ordenGlobalDe(
  item: PlanItem,
  index: ReadonlyMap<string, Requisito>,
): number {
  return index.get(item.gap.codigo)?.orden_global ?? 0;
}

/**
 * Agrupa los ítems (ya ordenados) por categoría. Las categorías se ordenan por el
 * orden_global mínimo de sus gaps — mismo criterio que `categoriasDe`, estable y sin
 * depender del orden de entrada. Dentro de cada grupo se preserva el orden total.
 */
function agruparPorCategoria(
  items: readonly PlanItem[],
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): PlanCategoria[] {
  interface Acum {
    nombre: string;
    ordenMin: number;
    items: PlanItem[];
  }
  const grupos = new Map<string, Acum>();

  for (const item of items) {
    const cod = item.gap.categoria_codigo;
    const orden = requisitosPorCodigo.get(item.gap.codigo)?.orden_global ?? 0;
    const g = grupos.get(cod);
    if (g === undefined) {
      grupos.set(cod, { nombre: item.gap.categoria, ordenMin: orden, items: [item] });
    } else {
      g.items.push(item);
      if (orden < g.ordenMin) g.ordenMin = orden;
    }
  }

  // Score de cada categoría con la MISMA aritmética canónica que la pantalla de resultado.
  const scores = calcularScorePorCategoria(respuestas, requisitosPorCodigo);

  return [...grupos.entries()]
    .sort((a, b) => a[1].ordenMin - b[1].ordenMin)
    .map(([codigo, g]) => ({
      codigo,
      nombre: g.nombre,
      score_pct: scores.get(codigo)?.score_pct ?? null,
      items: g.items,
    }));
}
