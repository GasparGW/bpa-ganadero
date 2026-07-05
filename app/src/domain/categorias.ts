/**
 * Categorías derivadas del instrumento (en orden de aparición por orden_global).
 * Dato puro que consumen la pantalla de evaluación (conteo por categoría) y la de
 * resultado (desglose). Se deriva de REQUISITOS, no se duplica.
 */

import type { Requisito } from './types';

export interface CategoriaInfo {
  readonly codigo: string;
  readonly nombre: string;
  readonly nRequisitos: number;
}

export function categoriasDe(reqs: readonly Requisito[]): CategoriaInfo[] {
  const acc = new Map<string, { nombre: string; n: number; orden: number }>();
  for (const r of reqs) {
    const c = acc.get(r.categoria_codigo);
    if (c === undefined) {
      acc.set(r.categoria_codigo, { nombre: r.categoria, n: 1, orden: r.orden_global });
    } else {
      c.n += 1;
      if (r.orden_global < c.orden) c.orden = r.orden_global;
    }
  }
  // Orden explícito por orden_global del primer requisito de cada categoría: no
  // depende de que `reqs` venga pre-ordenado ni de que las categorías sean contiguas.
  return [...acc.entries()]
    .sort((a, b) => a[1].orden - b[1].orden)
    .map(([codigo, c]) => ({ codigo, nombre: c.nombre, nRequisitos: c.n }));
}
