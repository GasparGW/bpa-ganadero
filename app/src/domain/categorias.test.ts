import { describe, expect, it } from 'vitest';

import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import { categoriasDe } from './categorias';
import { calcularScore, calcularScorePorCategoria } from './scoring';
import type { Respuestas } from './types';

const cats = categoriasDe(REQUISITOS);

describe('categoriasDe', () => {
  it('deriva 14 categorías que suman los 320 requisitos', () => {
    expect(cats).toHaveLength(14);
    expect(cats.reduce((s, c) => s + c.nRequisitos, 0)).toBe(REQUISITOS.length);
  });

  it('las ordena por orden_global ascendente, sin depender del orden de entrada', () => {
    // Barajar la entrada no debe cambiar el orden derivado: la categoría se ordena
    // por el orden_global MÍNIMO de sus requisitos, no por el orden en que llegan.
    const barajado = [...REQUISITOS].reverse();
    const orden = categoriasDe(barajado).map((c) => c.codigo);
    expect(orden).toEqual(cats.map((c) => c.codigo));

    const primero = [...REQUISITOS].sort((a, b) => a.orden_global - b.orden_global)[0];
    expect(orden[0]).toBe(primero.categoria_codigo);
  });

  it('cada nombre y conteo coincide con los requisitos de esa categoría', () => {
    for (const c of cats) {
      const propios = REQUISITOS.filter((r) => r.categoria_codigo === c.codigo);
      expect(c.nRequisitos).toBe(propios.length);
      expect(c.nombre).toBe(propios[0].categoria);
    }
  });
});

describe('calcularScorePorCategoria', () => {
  const grandes = cats.filter((c) => c.nRequisitos >= 2);

  it('cada categoría coincide con el score de su propio subconjunto', () => {
    const [cA, cB] = grandes;
    const reqsA = REQUISITOS.filter((r) => r.categoria_codigo === cA.codigo).slice(0, 2);
    const reqsB = REQUISITOS.filter((r) => r.categoria_codigo === cB.codigo).slice(0, 2);
    const respuestas: Respuestas = {
      [reqsA[0].codigo]: 'IT',
      [reqsA[1].codigo]: 'NI',
      [reqsB[0].codigo]: 'IP',
      [reqsB[1].codigo]: 'NA',
    };
    const porCat = calcularScorePorCategoria(respuestas, INDICE_REQUISITOS);
    const soloA = calcularScore({ [reqsA[0].codigo]: 'IT', [reqsA[1].codigo]: 'NI' }, INDICE_REQUISITOS);
    const soloB = calcularScore({ [reqsB[0].codigo]: 'IP', [reqsB[1].codigo]: 'NA' }, INDICE_REQUISITOS);
    expect(porCat.get(cA.codigo)).toEqual(soloA);
    expect(porCat.get(cB.codigo)).toEqual(soloB);
  });

  it('no crea entrada para una categoría sin respuestas puntuables', () => {
    const req = REQUISITOS.filter((r) => r.categoria_codigo === grandes[0].codigo)[0];
    const porCat = calcularScorePorCategoria({ [req.codigo]: 'IT' }, INDICE_REQUISITOS);
    expect(porCat.has(grandes[0].codigo)).toBe(true);
    expect(porCat.has(grandes[1].codigo)).toBe(false);
  });
});
