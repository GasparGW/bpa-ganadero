import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { indexarGuia } from '../domain/guia';
import { CODIGOS_EXPRESS } from '../express';
import { INDICE_REQUISITOS } from '../instrumento';
import { GUIA, GUIA_META, INDICE_GUIA } from './index';

/**
 * Validez del bundle de guía: lo que se testea es EXACTAMENTE lo que se empaqueta
 * (importa el módulo generado vía index.ts). El motor de plan es puro y ya tiene sus
 * tests con fixtures; acá cuidamos la INTEGRIDAD DE LOS DATOS curados a mano.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const JSON_FUENTE = join(AQUI, '../../../data/guia/bpg-vc_2026.07.json');

describe('bundle de guía (BPG-VC 2026.07)', () => {
  it('cada entrada corresponde a un requisito real del instrumento', () => {
    for (const g of GUIA) {
      expect(INDICE_REQUISITOS.has(g.codigo), `código de guía inexistente: ${g.codigo}`).toBe(true);
    }
  });

  it('el bundle .ts no divergió del JSON fuente (regenerar tras editar datos)', () => {
    // Guard anti-drift: el .ts es artefacto generado. Si alguien edita el JSON y olvida
    // correr gen_guia_ts.mjs, este test lo atrapa antes de que llegue al bundle.
    const fuente = JSON.parse(readFileSync(JSON_FUENTE, 'utf8')) as {
      entradas: {
        codigo: string;
        estado: string;
        como_implementar: string[];
        cita: { item: string | null };
        nivel_esfuerzo: string | null;
      }[];
    };
    expect(fuente.entradas.length, 'cantidad de entradas JSON ≠ bundle').toBe(GUIA.length);
    expect(GUIA_META.total_entradas, 'GUIA_META.total_entradas ≠ GUIA.length').toBe(GUIA.length);
    const bundlePorCodigo = new Map(GUIA.map((g) => [g.codigo, g]));
    for (const e of fuente.entradas) {
      const g = bundlePorCodigo.get(e.codigo);
      expect(g, `${e.codigo} en JSON pero no en el bundle (falta regenerar)`).toBeDefined();
      expect(g!.estado, `${e.codigo} estado divergente`).toBe(e.estado);
      expect(g!.cita.item, `${e.codigo} cita divergente`).toBe(e.cita.item ?? null);
      expect(g!.como_implementar.length, `${e.codigo} nº de pasos divergente`).toBe(
        e.como_implementar.length,
      );
      expect(g!.nivel_esfuerzo, `${e.codigo} esfuerzo divergente`).toBe(e.nivel_esfuerzo ?? null);
    }
  });

  it('indexarGuia rechaza códigos duplicados (no silencia colisiones)', () => {
    const g = GUIA[0];
    expect(() => indexarGuia([g, g])).toThrow(/duplicada/);
    // Y en el bundle real no hay duplicados: el índice cubre todas las entradas.
    expect(INDICE_GUIA.size).toBe(GUIA.length);
  });

  it('cubre los esenciales del modo express con guía curada (nunca queda sin guía)', () => {
    for (const codigo of CODIGOS_EXPRESS) {
      const g = INDICE_GUIA.get(codigo);
      expect(g, `falta guía para el express ${codigo}`).toBeDefined();
      expect(g!.estado, `${codigo} express debería tener guía curada, no derivada`).toBe('curada');
    }
  });

  it('toda entrada curada trae pasos, evidencia y una cita a ítem(s) N.M verificado(s)', () => {
    for (const g of GUIA) {
      if (g.estado !== 'curada') continue;
      expect(g.como_implementar.length, `${g.codigo} sin pasos`).toBeGreaterThan(0);
      expect(g.como_implementar.every((p) => p.trim().length > 0)).toBe(true);
      expect(g.evidencia_sugerida?.trim().length ?? 0, `${g.codigo} sin evidencia`).toBeGreaterThan(0);
      expect(g.cita.seccion.trim().length, `${g.codigo} sin sección`).toBeGreaterThan(0);
      // La cita curada apunta a uno o más ítems concretos: "13.23" o "13.1, 13.5".
      expect(g.cita.item, `${g.codigo} cita sin ítem`).not.toBeNull();
      expect(g.cita.item ?? '', `${g.codigo} ítem mal formado: ${g.cita.item}`).toMatch(
        /^\d+\.\d+(, \d+\.\d+)*$/,
      );
    }
  });

  it('toda entrada derivada no inventa pasos (cita a nivel de categoría)', () => {
    for (const g of GUIA) {
      if (g.estado !== 'derivada') continue;
      expect(g.como_implementar.length, `${g.codigo} derivada con pasos inventados`).toBe(0);
      expect(g.cita.item, `${g.codigo} derivada debería citar sólo categoría`).toBeNull();
    }
  });
});
