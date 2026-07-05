/**
 * Scoring canónico BPG-VC.
 *
 * Fórmula oficial de la Red BPA:
 *   score = Σ(peso × mult) / Σ(peso | estado ≠ NA) × 100
 * con pesos NP1=10 / NP2=5 / NP3=2.5 y multiplicadores IT=1 / IP=0.5 / NI=0.
 * NA se excluye del denominador (no penaliza ni suma).
 *
 * Esta es UNA de las tres implementaciones que deben coincidir: referencia Python
 * (scripts/build_instrumento.py), este cliente TS, y la función SQL del servidor
 * (supabase/migrations). Las tres se validan contra data/golden_scoring.json.
 * Si cambiás algo acá, corré `npm test` y verificá que los 8 casos siguen pasando.
 */

import type { EstadoRequisito, Requisito, ResultadoScore, Respuestas } from './types';

/** Multiplicador por estado. NA no figura: se excluye antes de llegar acá. */
const MULTIPLICADORES: Readonly<Record<'IT' | 'IP' | 'NI', number>> = {
  IT: 1,
  IP: 0.5,
  NI: 0,
};

/** Redondeo a 2 decimales, mitad hacia arriba, estable para reproducir golden cases. */
function redondear2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Construye el índice código → requisito que consume `calcularScore`. */
export function indexarRequisitos(
  requisitos: readonly Requisito[],
): ReadonlyMap<string, Requisito> {
  const m = new Map<string, Requisito>();
  for (const r of requisitos) {
    if (m.has(r.codigo)) {
      throw new Error(`Requisito duplicado en el instrumento: ${r.codigo}`);
    }
    m.set(r.codigo, r);
  }
  return m;
}

/**
 * Calcula el score de un conjunto de respuestas contra el instrumento indexado.
 *
 * @throws si una respuesta referencia un código que no existe en el instrumento
 *         (fallar ruidoso: nunca puntuar sobre datos inconsistentes).
 */
export function calcularScore(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): ResultadoScore {
  let numerador = 0;
  let denominador = 0;

  for (const [codigo, estado] of Object.entries(respuestas)) {
    if (estado === 'NA') continue;
    const req = requisitosPorCodigo.get(codigo);
    if (req === undefined) {
      throw new Error(`Respuesta sobre requisito desconocido: ${codigo}`);
    }
    numerador += req.peso * MULTIPLICADORES[estado];
    denominador += req.peso;
  }

  return {
    puntos_obtenidos: redondear2(numerador),
    maximo_aplicable: redondear2(denominador),
    score_pct: denominador === 0 ? null : redondear2((numerador / denominador) * 100),
  };
}

/** Score desagregado por categoría (código de categoría → resultado). Para la pantalla de resultado. */
export function calcularScorePorCategoria(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): ReadonlyMap<string, ResultadoScore> {
  const porCategoria = new Map<string, Record<string, EstadoRequisito>>();

  for (const [codigo, estado] of Object.entries(respuestas)) {
    const req = requisitosPorCodigo.get(codigo);
    if (req === undefined) {
      throw new Error(`Respuesta sobre requisito desconocido: ${codigo}`);
    }
    const cat = req.categoria_codigo;
    (porCategoria.get(cat) ?? porCategoria.set(cat, {}).get(cat)!)[codigo] = estado;
  }

  const resultado = new Map<string, ResultadoScore>();
  for (const [cat, resp] of porCategoria) {
    resultado.set(cat, calcularScore(resp, requisitosPorCodigo));
  }
  return resultado;
}
