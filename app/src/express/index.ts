/**
 * Modo express — un subconjunto curado de requisitos ESENCIALES (NP1) que un
 * productor puede responder de memoria, sin buscar papeles. No es una medida oficial:
 * es una prueba rápida ("probá como si fuera tu establecimiento") que muestra el valor
 * del autodiagnóstico en pocos minutos y siembra el plan de acción.
 *
 * CERO cambios de dominio: reutiliza los MISMOS requisitos del instrumento canónico,
 * el MISMO flujo de evaluación y el MISMO análisis de gaps. Lo único propio es la
 * selección de códigos y el resumen "M de N esenciales" (sin porcentaje) de la pantalla
 * de resultado. El modo viaja por parámetro de navegación, no por la base.
 */

import type { EstadoRequisito, Requisito, Respuestas } from '../domain/types';
import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';

/**
 * Los 15 esenciales del modo express. Todos NP1, respondibles de memoria y repartidos
 * por categoría (agua, alimentación, identificación, sanidad, personal, residuos,
 * efluentes, establecimiento). El orden de recorrido es el del instrumento (orden_global).
 */
export const CODIGOS_EXPRESS: readonly string[] = [
  'EST-001', // mapa/croquis del establecimiento
  'AGU-002', // agua de calidad y cantidad suficiente para todos los usos
  'INS-016', // agua para bebida y sombra para los animales
  'ALI-001', // plan de alimentación
  'ROD-005', // animales identificados según normas vigentes
  'ROD-006', // registro de los animales identificados
  'SAN-002', // asesoramiento veterinario permanente
  'SAN-007', // calendario de vacunaciones
  'SAN-011', // Libro de Registro de Tratamientos (SENASA) actualizado
  'SAN-034', // animales enfermos identificados, tratados y apartados
  'SAN-048', // cadena de frío para medicamentos que la requieren
  'PER-004', // ropa de trabajo y equipamiento de protección
  'PER-017', // botiquines de primeros auxilios y matafuegos
  'RSD-001', // disposición de residuos de fitosanitarios y veterinarios
  'EFL-002', // plan de tratamiento de estiércol y efluentes
];

/**
 * Los requisitos express resueltos contra el instrumento, en orden de instrumento.
 * Se valida al cargar el módulo (fail-loud, mismo criterio que `indexarRequisitos`):
 * si un código no existe o no es NP1, es un error de datos, no un caso a tolerar.
 */
export const REQUISITOS_EXPRESS: readonly Requisito[] = (() => {
  const codigos = new Set(CODIGOS_EXPRESS);
  if (codigos.size !== CODIGOS_EXPRESS.length) {
    throw new Error('CODIGOS_EXPRESS tiene códigos duplicados');
  }
  for (const codigo of CODIGOS_EXPRESS) {
    const req = INDICE_REQUISITOS.get(codigo);
    if (req === undefined) {
      throw new Error(`Código express inexistente en el instrumento: ${codigo}`);
    }
    if (req.np !== 1) {
      throw new Error(`Código express no es esencial (NP1): ${codigo} es NP${req.np}`);
    }
  }
  return REQUISITOS.filter((r) => codigos.has(r.codigo));
})();

/** Resumen "M de N esenciales" del modo express. Sin porcentaje: conteos crudos. */
export interface ResumenExpress {
  /** Total de esenciales del set express (N). */
  readonly total: number;
  /** Implementados totalmente (IT) — la M de "M de N". */
  readonly implementados: number;
  /** Implementados parcialmente (IP). */
  readonly parciales: number;
  /** Sin implementar (NI) — lo que alimenta el plan de acción. */
  readonly sinImplementar: number;
  /** No aplica (NA). */
  readonly noAplica: number;
  /** Aún sin responder (N menos los cuatro estados anteriores). */
  readonly sinResponder: number;
}

/**
 * Resume las respuestas del set express en conteos por estado. Puro y determinista.
 * Ignora respuestas de códigos fuera del set (defensivo: el resumen es sobre los N
 * esenciales, no sobre lo que haya en la evaluación).
 */
export function resumenExpress(
  respuestas: Respuestas,
  codigos: readonly string[] = CODIGOS_EXPRESS,
): ResumenExpress {
  const conteo: Record<EstadoRequisito, number> = { IT: 0, IP: 0, NI: 0, NA: 0 };
  for (const codigo of codigos) {
    const estado = respuestas[codigo];
    if (estado !== undefined) conteo[estado] += 1;
  }
  const total = codigos.length;
  return {
    total,
    implementados: conteo.IT,
    parciales: conteo.IP,
    sinImplementar: conteo.NI,
    noAplica: conteo.NA,
    sinResponder: total - conteo.IT - conteo.IP - conteo.NI - conteo.NA,
  };
}
