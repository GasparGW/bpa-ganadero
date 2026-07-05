import { describe, expect, it } from 'vitest';

import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import { analizarGaps } from './gaps';
import { calcularScore } from './scoring';
import type { Respuestas } from './types';

const np1 = REQUISITOS.filter((r) => r.np === 1);
const np2 = REQUISITOS.filter((r) => r.np === 2);
const np3 = REQUISITOS.filter((r) => r.np === 3);

describe('analizarGaps', () => {
  it('prioriza NI por NP, cuenta NP1-NI y proyecta el score potencial', () => {
    const respuestas: Respuestas = {
      [np1[0].codigo]: 'NI',
      [np1[1].codigo]: 'IT',
      [np2[0].codigo]: 'NI',
      [np3[0].codigo]: 'NI',
    };
    const a = analizarGaps(respuestas, INDICE_REQUISITOS);

    // num=10 (un NP1 IT), den=10+10+5+2.5=27.5 ⇒ 36,36 %.
    expect(a.score_actual).toBe(36.36);
    // Resolver el único NP1-NI (→ IT): num=20, den=27.5 ⇒ 72,73 %.
    expect(a.score_potencial).toBe(72.73);
    expect(a.np1_ni).toBe(1);

    // Los tres NI, ordenados por prioridad NP1 → NP2 → NP3.
    expect(a.gaps.map((g) => g.codigo)).toEqual([np1[0].codigo, np2[0].codigo, np3[0].codigo]);
    expect(a.gaps.map((g) => g.np)).toEqual([1, 2, 3]);
  });

  it('score_potencial coincide con recalcular volteando los NP1-NI a IT', () => {
    const respuestas: Respuestas = {
      [np1[0].codigo]: 'NI',
      [np1[1].codigo]: 'NI',
      [np2[0].codigo]: 'IP',
    };
    const a = analizarGaps(respuestas, INDICE_REQUISITOS);
    const volteado = calcularScore(
      { ...respuestas, [np1[0].codigo]: 'IT', [np1[1].codigo]: 'IT' },
      INDICE_REQUISITOS,
    );
    expect(a.score_potencial).toBe(volteado.score_pct);
    expect(a.np1_ni).toBe(2);
  });

  it('desempata gaps del mismo NP por orden_global, no por el orden de respuesta', () => {
    // Dos NP1-NI insertados en orden_global DESCENDENTE: el resultado debe salir
    // ascendente (el requisito que aparece antes en el instrumento va primero).
    const [a1, a2] = np1.slice(0, 2);
    const respuestas: Respuestas = { [a2.codigo]: 'NI', [a1.codigo]: 'NI' };
    const a = analizarGaps(respuestas, INDICE_REQUISITOS);
    const esperado = [a1, a2]
      .sort((x, y) => x.orden_global - y.orden_global)
      .map((r) => r.codigo);
    expect(a.gaps.map((g) => g.codigo)).toEqual(esperado);
  });

  it('sin nada aplicable (todo NA) el score y su potencial son null', () => {
    const respuestas: Respuestas = { [np1[0].codigo]: 'NA', [np2[0].codigo]: 'NA' };
    const a = analizarGaps(respuestas, INDICE_REQUISITOS);
    expect(a.score_actual).toBeNull();
    expect(a.score_potencial).toBeNull();
    expect(a.gaps).toHaveLength(0);
    expect(a.np1_ni).toBe(0);
  });
});
