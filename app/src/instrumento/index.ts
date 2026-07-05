/**
 * Carga del instrumento canónico en runtime.
 *
 * Punto de entrada único para la app: importá desde acá, no del archivo generado.
 * El instrumento viene empaquetado (módulo TS generado) — no hay I/O ni red, así
 * que funciona offline y en el runtime de RN sin configuración de Metro.
 */
import { indexarRequisitos } from '../domain/scoring';
import { INSTRUMENTO_META, REQUISITOS } from './bpg-vc_2026.07';

export { INSTRUMENTO_META, REQUISITOS };

/** Índice código → requisito, listo para `calcularScore`. Se construye una vez. */
export const INDICE_REQUISITOS = indexarRequisitos(REQUISITOS);
