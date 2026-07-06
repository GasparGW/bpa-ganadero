import { describe, expect, it } from 'vitest';

import type { Respuestas } from '../domain/types';
import { CODIGOS_EXPRESS, REQUISITOS_EXPRESS, resumenExpress } from './index';

describe('subset express', () => {
  it('resuelve todos los códigos y son todos NP1', () => {
    expect(REQUISITOS_EXPRESS).toHaveLength(CODIGOS_EXPRESS.length);
    for (const r of REQUISITOS_EXPRESS) expect(r.np).toBe(1);
  });

  it('no tiene códigos duplicados', () => {
    expect(new Set(CODIGOS_EXPRESS).size).toBe(CODIGOS_EXPRESS.length);
  });

  it('conserva el orden del instrumento (orden_global ascendente)', () => {
    const ordenes = REQUISITOS_EXPRESS.map((r) => r.orden_global);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
  });
});

describe('resumenExpress', () => {
  it('cuenta por estado y calcula sinResponder', () => {
    const respuestas: Respuestas = {
      'EST-001': 'IT',
      'AGU-002': 'IT',
      'INS-016': 'IP',
      'ALI-001': 'NI',
      'ROD-005': 'NA',
    };
    const r = resumenExpress(respuestas);
    expect(r.total).toBe(CODIGOS_EXPRESS.length);
    expect(r.implementados).toBe(2);
    expect(r.parciales).toBe(1);
    expect(r.sinImplementar).toBe(1);
    expect(r.noAplica).toBe(1);
    expect(r.sinResponder).toBe(CODIGOS_EXPRESS.length - 5);
  });

  it('todo respondido no deja pendientes', () => {
    const respuestas: Respuestas = Object.fromEntries(
      CODIGOS_EXPRESS.map((c) => [c, 'IT' as const]),
    );
    const r = resumenExpress(respuestas);
    expect(r.implementados).toBe(CODIGOS_EXPRESS.length);
    expect(r.sinResponder).toBe(0);
  });

  it('ignora respuestas de códigos fuera del set express', () => {
    const respuestas: Respuestas = { 'ORG-003': 'IT', 'EST-001': 'IT' };
    const r = resumenExpress(respuestas);
    expect(r.implementados).toBe(1); // sólo EST-001, ORG-003 no está en el set
  });

  it('sin respuestas: todo sinResponder', () => {
    const r = resumenExpress({});
    expect(r.sinResponder).toBe(CODIGOS_EXPRESS.length);
    expect(r.implementados).toBe(0);
  });
});
