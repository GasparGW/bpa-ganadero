/**
 * Golden tests del scoring. Cargan el instrumento canónico y los 8 casos dorados
 * desde `data/` (fuente de verdad compartida por las 3 implementaciones) y exigen
 * coincidencia exacta. Si esto falla, el scoring del cliente divergió del oficial.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import { calcularScore, indexarRequisitos } from './scoring';
import type { Requisito, ResultadoScore, Respuestas } from './types';

const aquí = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(aquí, '../../../data');

interface Instrumento {
  requisitos: Requisito[];
}
interface CasoGolden {
  nombre: string;
  descripcion: string;
  respuestas: Respuestas;
  esperado: ResultadoScore;
}
interface Golden {
  instrumento: string;
  version_instrumento: string;
  casos: CasoGolden[];
}

const instrumento: Instrumento = JSON.parse(
  readFileSync(resolve(dataDir, 'instrumento/bpg-vc_2026.07.json'), 'utf8'),
);
const golden: Golden = JSON.parse(
  readFileSync(resolve(dataDir, 'golden_scoring.json'), 'utf8'),
);

const indice = indexarRequisitos(instrumento.requisitos);

describe('scoring BPG-VC contra golden cases', () => {
  it('el instrumento tiene 320 requisitos', () => {
    expect(instrumento.requisitos).toHaveLength(320);
  });

  for (const caso of golden.casos) {
    it(`${caso.nombre}: ${caso.descripcion}`, () => {
      const resultado = calcularScore(caso.respuestas, indice);
      expect(resultado).toEqual(caso.esperado);
    });
  }

  it('rechaza respuestas sobre un código inexistente', () => {
    expect(() => calcularScore({ 'XXX-999': 'IT' }, indice)).toThrow(/desconocido/);
  });
});
