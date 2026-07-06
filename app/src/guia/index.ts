/**
 * Carga del contenido de guía en runtime.
 *
 * Punto de entrada único para la app: importá desde acá, no del archivo generado.
 * La guía viene empaquetada (módulo TS generado) — no hay I/O ni red, así que
 * funciona offline y en el runtime de RN sin configuración de Metro.
 */
import { indexarGuia } from '../domain/guia';
import { GUIA, GUIA_META } from './bpg-vc_2026.07';

export { GUIA, GUIA_META };

/** Índice código → guía, listo para `construirPlan`. Se construye una vez. */
export const INDICE_GUIA = indexarGuia(GUIA);
