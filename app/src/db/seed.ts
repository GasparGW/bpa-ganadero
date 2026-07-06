/**
 * Caso piloto sembrado para la demostración: un establecimiento con una evaluación
 * express ya CERRADA, con respuestas realistas (implementados, parciales y cinco
 * esenciales sin implementar repartidos en cinco categorías). Deja la app en un estado
 * rico para mostrar de una: resultado congelado + plan de acción con guía curada.
 *
 * Idempotente por IDs fijos: si el caso ya existe se reusa (no se apila en cada carga).
 * Todo el sembrado —crear, responder y cerrar— va en UNA transacción: o queda el caso
 * completo y cerrado, o no queda nada (nunca un caso a medias que rompa el resultado).
 */

import type { EstadoRequisito } from '../domain/types';
import { INDICE_REQUISITOS, INSTRUMENTO_META } from '../instrumento';
import type { SqlDriver } from './driver';
import * as repos from './repos';
import { TENANT_LOCAL } from './tenant';

// UUIDv4 fijos (válidos): sembrar dos veces reusa el mismo caso en vez de duplicar.
const ESTABLECIMIENTO_DEMO = '00000000-0000-4000-8000-000000000001';
const EVALUACION_DEMO = '00000000-0000-4000-8000-000000000002';

const NOMBRE_DEMO = 'Establecimiento La Querencia';
const RENSPA_DEMO = '01.234.5.67890/01';

/**
 * Respuestas de los 15 esenciales del modo express. 7 implementados, 3 parciales y 5 sin
 * implementar (EST/AGU/SAN/PER/EFL) — un caso creíble de "arrancó pero le faltan cosas",
 * con gaps en cinco categorías distintas y esfuerzos bajo→alto para lucir la priorización.
 */
const RESPUESTAS_DEMO: Readonly<Record<string, EstadoRequisito>> = {
  'EST-001': 'NI',
  'AGU-002': 'NI',
  'SAN-007': 'NI',
  'PER-017': 'NI',
  'EFL-002': 'NI',
  'INS-016': 'IP',
  'ROD-005': 'IP',
  'ALI-001': 'IP',
  'ROD-006': 'IT',
  'SAN-002': 'IT',
  'SAN-011': 'IT',
  'SAN-034': 'IT',
  'SAN-048': 'IT',
  'PER-004': 'IT',
  'RSD-001': 'IT',
};

export interface CasoDemo {
  readonly evaluacionId: string;
  readonly establecimientoNombre: string;
  readonly renspa: string | null;
}

const CASO: CasoDemo = {
  evaluacionId: EVALUACION_DEMO,
  establecimientoNombre: NOMBRE_DEMO,
  renspa: RENSPA_DEMO,
};

/**
 * Siembra (o reusa) el caso piloto y devuelve sus datos de navegación al Resultado.
 * `ahora` se inyecta (ISO) para no depender del reloj acá y mantenerlo testeable.
 */
export async function cargarCasoDemo(db: SqlDriver, ahora: string): Promise<CasoDemo> {
  const existente = await repos.getEvaluacion(db, EVALUACION_DEMO);
  if (existente !== null) return CASO;

  await repos.enTransaccion(db, async () => {
    await repos.crearEstablecimiento(db, {
      id: ESTABLECIMIENTO_DEMO,
      tenantId: TENANT_LOCAL,
      nombre: NOMBRE_DEMO,
      renspa: RENSPA_DEMO,
      ahora,
    });
    await repos.crearEvaluacion(db, {
      id: EVALUACION_DEMO,
      tenantId: TENANT_LOCAL,
      establecimientoId: ESTABLECIMIENTO_DEMO,
      instrumento: INSTRUMENTO_META.instrumento,
      version: INSTRUMENTO_META.version,
      modo: 'express',
      ahora,
    });
    for (const [codigo, estado] of Object.entries(RESPUESTAS_DEMO)) {
      await repos.setRespuesta(db, {
        // Id determinístico por (evaluación, requisito): sembrar es reproducible y el
        // upsert de setRespuesta queda idempotente sin depender de un RNG.
        id: `${EVALUACION_DEMO}:${codigo}`,
        tenantId: TENANT_LOCAL,
        evaluacionId: EVALUACION_DEMO,
        requisitoCodigo: codigo,
        estado,
        ahora,
      });
    }
    await repos.cerrarEvaluacion(db, {
      evaluacionId: EVALUACION_DEMO,
      requisitosPorCodigo: INDICE_REQUISITOS,
      ahora,
    });
  });

  return CASO;
}
