/**
 * Scoring canónico BPG-VC.
 *
 * Fórmula oficial de la Red BPA:
 *   score = Σ(peso × mult) / Σ(peso | estado ≠ NA) × 100
 * con pesos NP1=10 / NP2=5 / NP3=2.5 y multiplicadores IT=1 / IP=0.5 / NI=0.
 * NA se excluye del denominador (no penaliza ni suma).
 *
 * ARITMÉTICA EXACTA (contrato de las tres capas). El cálculo se hace en enteros
 * escalados ×4 — así peso×mult ∈ {40,20,10,5,0} y peso ∈ {40,20,10} son SIEMPRE
 * enteros, sin error de representación float. El porcentaje se redondea a 2
 * decimales con una única regla: MITAD HACIA ARRIBA (= "half away from zero" para
 * valores no negativos, idéntica a `round(numeric, 2)` de Postgres). Python
 * (referencia) y SQL (servidor) usan exactamente esta misma aritmética y regla.
 * Cualquier divergencia entre las tres es un bug: `data/golden_scoring.json`
 * incluye un caso de empate (`.xx5`) que la detecta. Corré `npm test` tras tocar esto.
 */

import type { EstadoRequisito, Requisito, ResultadoScore, Respuestas } from './types';

/** Peso escalado ×4 por Nivel de Prioridad. Entero exacto (10/5/2.5 → 40/20/10). */
const PESO_X4: Readonly<Record<1 | 2 | 3, number>> = { 1: 40, 2: 20, 3: 10 };

/** Multiplicador por estado. NA no figura: se excluye antes de acumular. */
const MULTIPLICADORES: Readonly<Record<'IT' | 'IP' | 'NI', number>> = {
  IT: 1,
  IP: 0.5,
  NI: 0,
};

const ESTADOS_VALIDOS: ReadonlySet<string> = new Set(['IT', 'IP', 'NI', 'NA']);

/**
 * Redondeo a 2 decimales, mitad hacia arriba, a partir de un cociente entero
 * `numX4 / denX4` interpretado como porcentaje. Todo el cálculo es entero: no hay
 * float intermedio, así que el resultado es idéntico bit a bit al de SQL/Python.
 *
 * pct = numX4/denX4 × 100 ; queremos round(pct × 100)/100 (mitad arriba)
 *     = floor((2 × numX4 × 10000 + denX4) / (2 × denX4)) / 100
 * denX4 ≤ 9780 → el numerador entero ≤ ~1.96e8, muy dentro de Number.MAX_SAFE_INTEGER.
 */
function porcentajeExacto(numX4: number, denX4: number): number {
  const centesimos = Math.floor((2 * numX4 * 10000 + denX4) / (2 * denX4));
  return centesimos / 100;
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
 * @throws si una respuesta tiene un estado inválido (no IT/IP/NI/NA) o referencia
 *         un código que no existe en el instrumento. Fallar ruidoso: nunca puntuar
 *         sobre datos inconsistentes (mismo contrato que la función SQL).
 */
export function calcularScore(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): ResultadoScore {
  let numX4 = 0;
  let denX4 = 0;

  for (const [codigo, estado] of Object.entries(respuestas)) {
    if (!ESTADOS_VALIDOS.has(estado)) {
      throw new Error(`Estado inválido para ${codigo}: ${estado}`);
    }
    if (estado === 'NA') continue;
    const req = requisitosPorCodigo.get(codigo);
    if (req === undefined) {
      throw new Error(`Respuesta sobre requisito desconocido: ${codigo}`);
    }
    const pesoX4 = PESO_X4[req.np];
    numX4 += pesoX4 * MULTIPLICADORES[estado];
    denX4 += pesoX4;
  }

  return {
    puntos_obtenidos: numX4 / 4,
    maximo_aplicable: denX4 / 4,
    score_pct: denX4 === 0 ? null : porcentajeExacto(numX4, denX4),
  };
}

/** Score desagregado por categoría (código de categoría → resultado). Para la pantalla de resultado. */
export function calcularScorePorCategoria(
  respuestas: Respuestas,
  requisitosPorCodigo: ReadonlyMap<string, Requisito>,
): ReadonlyMap<string, ResultadoScore> {
  const porCategoria = new Map<string, Record<string, EstadoRequisito>>();

  for (const [codigo, estado] of Object.entries(respuestas)) {
    if (!ESTADOS_VALIDOS.has(estado)) {
      throw new Error(`Estado inválido para ${codigo}: ${estado}`);
    }
    if (estado === 'NA') continue;
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
