/**
 * Golden tests del scoring. Cargan el instrumento EMPAQUETADO (el mismo módulo TS
 * que consume la app en runtime) y los golden cases desde `data/`, y exigen
 * coincidencia exacta. Al testear el instrumento bundleado —no el JSON de `data/`—
 * se garantiza que lo que se valida es exactamente lo que se envía en la app.
 * Si esto falla, el scoring del cliente divergió del oficial.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import { calcularScore } from './scoring';
import type { ResultadoScore, Respuestas } from './types';
import { INDICE_REQUISITOS, INSTRUMENTO_META, REQUISITOS } from '../instrumento';

const aquí = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(aquí, '../../../data');

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

const golden: Golden = JSON.parse(
  readFileSync(resolve(dataDir, 'golden_scoring.json'), 'utf8'),
);

describe('scoring BPG-VC contra golden cases', () => {
  it('el instrumento empaquetado tiene 320 requisitos', () => {
    expect(REQUISITOS).toHaveLength(320);
    expect(INSTRUMENTO_META.total_requisitos).toBe(320);
  });

  it('el instrumento empaquetado corresponde a la versión del golden', () => {
    expect(INSTRUMENTO_META.version).toBe(golden.version_instrumento);
  });

  for (const caso of golden.casos) {
    it(`${caso.nombre}: ${caso.descripcion}`, () => {
      const resultado = calcularScore(caso.respuestas, INDICE_REQUISITOS);
      expect(resultado).toEqual(caso.esperado);
    });
  }

  it('rechaza respuestas sobre un código inexistente', () => {
    expect(() => calcularScore({ 'XXX-999': 'IT' }, INDICE_REQUISITOS)).toThrow(
      /desconocido/,
    );
  });

  it('rechaza un estado inválido (payload corrupto de sync)', () => {
    const codigo = REQUISITOS[0].codigo;
    expect(() => calcularScore({ [codigo]: 'XX' as never }, INDICE_REQUISITOS)).toThrow(
      /inválido/,
    );
  });
});
