/**
 * Tipos del dominio BPG-VC (Buenas Prácticas Ganaderas — Ciclo Vacuno).
 *
 * El instrumento oficial de la Comisión de Ganadería de la Red BPA modela cada
 * requisito con un Nivel de Prioridad (NP) que fija su peso, y cada respuesta con
 * un estado de implementación. El scoring se define en `scoring.ts` y debe
 * reproducir exactamente los casos de `data/golden_scoring.json`.
 */

/** Estado de implementación de un requisito en una evaluación. */
export type EstadoRequisito = 'IT' | 'IP' | 'NI' | 'NA';

/** Nivel de Prioridad: 1 Esencial · 2 Importante · 3 Complementario. */
export type NivelPrioridad = 1 | 2 | 3;

/** Un requisito del instrumento canónico. Forma espejo de `data/instrumento/*.json`. */
export interface Requisito {
  /** Código estable CAT-NNN (p. ej. "SAN-042"). Clave natural, nunca cambia. */
  readonly codigo: string;
  readonly categoria_codigo: string;
  readonly categoria: string;
  readonly seccion: string;
  readonly orden_global: number;
  readonly orden_categoria: number;
  readonly texto: string;
  readonly np: NivelPrioridad;
  /** Peso derivado del NP (10 / 5 / 2.5). Persistido para no depender del mapa. */
  readonly peso: number;
}

/** Resultado del cálculo de score, en la forma exacta de los golden cases. */
export interface ResultadoScore {
  /** Σ(peso × multiplicador) sobre requisitos con estado ≠ NA. */
  readonly puntos_obtenidos: number;
  /** Σ(peso) sobre requisitos con estado ≠ NA (denominador). */
  readonly maximo_aplicable: number;
  /** puntos_obtenidos / maximo_aplicable × 100. `null` si no hay nada aplicable. */
  readonly score_pct: number | null;
}

/** Mapa código de requisito → estado, tal como se guarda en una evaluación. */
export type Respuestas = Readonly<Record<string, EstadoRequisito>>;
