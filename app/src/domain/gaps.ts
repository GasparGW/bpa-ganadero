/**
 * Análisis de brechas (gaps) de una evaluación.
 *
 * El valor central del producto tras el score es la PRIORIZACIÓN: qué resolver
 * primero. La regla oficial de la Red BPA prioriza los requisitos Esenciales (NP1)
 * No Implementados (NI) — son los que más pesan y los que faltan. Este módulo:
 *   - lista los requisitos en NI ordenados por prioridad (NP1 → NP2 → NP3),
 *   - cuenta los NP1 sin implementar (el titular del banner de resultado),
 *   - calcula a cuánto subiría el score si se resolvieran esos NP1 (NI → IT).
 *
 * Puro y determinista: misma spec de scoring, se testea con casos dorados propios.
 */

import { calcularScore } from './scoring';
import type { NivelPrioridad, Requisito, Respuestas } from './types';

/** Un requisito no implementado, con lo necesario para mostrarlo en el plan. */
export interface Gap {
  readonly codigo: string;
  readonly categoria_codigo: string;
  readonly categoria: string;
  readonly seccion: string;
  readonly texto: string;
  readonly np: NivelPrioridad;
}

export interface AnalisisGaps {
  /** Score actual (%). `null` si no hay nada aplicable (todo NA). */
  readonly score_actual: number | null;
  /** Score si TODOS los NP1 en NI pasaran a IT. `null` si el actual es `null`. */
  readonly score_potencial: number | null;
  /** Cantidad de requisitos Esenciales (NP1) en estado NI. */
  readonly np1_ni: number;
  /** Requisitos en NI, ordenados por prioridad (NP asc) y luego orden global. */
  readonly gaps: readonly Gap[];
}

/**
 * Analiza las brechas de un conjunto de respuestas contra el instrumento indexado.
 *
 * @throws (vía calcularScore) si hay un estado inválido o un código desconocido:
 *         nunca se prioriza sobre datos inconsistentes.
 */
export function analizarGaps(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): AnalisisGaps {
  const gaps: Gap[] = [];
  // Copia mutable de las respuestas para simular la resolución de los NP1-NI.
  const conNp1Resueltos: Record<string, Respuestas[string]> = { ...respuestas };

  for (const [codigo, estado] of Object.entries(respuestas)) {
    if (estado !== 'NI') continue;
    const req = requisitosPorCodigo.get(codigo);
    // calcularScore (abajo) es la autoridad de validación; si el código no existe
    // o el estado es inválido, tirará. Acá sólo juntamos los NI conocidos.
    if (req === undefined) continue;
    gaps.push({
      codigo: req.codigo,
      categoria_codigo: req.categoria_codigo,
      categoria: req.categoria,
      seccion: req.seccion,
      texto: req.texto,
      np: req.np,
    });
    if (req.np === 1) conNp1Resueltos[codigo] = 'IT';
  }

  gaps.sort((a, b) => a.np - b.np || ordenGlobal(a, b, requisitosPorCodigo));

  const score_actual = calcularScore(respuestas, requisitosPorCodigo).score_pct;
  const score_potencial =
    score_actual === null
      ? null
      : calcularScore(conNp1Resueltos, requisitosPorCodigo).score_pct;

  return {
    score_actual,
    score_potencial,
    np1_ni: gaps.reduce((n, g) => (g.np === 1 ? n + 1 : n), 0),
    gaps,
  };
}

function ordenGlobal(
  a: Gap,
  b: Gap,
  index: ReadonlyMap<string, Requisito>,
): number {
  const ra = index.get(a.codigo);
  const rb = index.get(b.codigo);
  return (ra?.orden_global ?? 0) - (rb?.orden_global ?? 0);
}
