/**
 * Punto de entrada del theme. Reexporta los tokens generados y agrega helpers
 * puros que mapean el dominio (EstadoRequisito en mayúsculas) a las claves de
 * color del theme (en minúsculas). Sin dependencias de React Native: testeable.
 */

import type { EstadoRequisito } from '../domain/types';
import { color, type Estado } from './tokens';

export * from './tokens';

/** EstadoRequisito del dominio ('IT') → clave del theme ('it'). */
export function claveEstado(estado: EstadoRequisito): Estado {
  return estado.toLowerCase() as Estado;
}

/** Color pleno del estado (para texto/borde y relleno seleccionado). */
export function colorEstado(estado: EstadoRequisito): string {
  return color.estado[claveEstado(estado)];
}

/** Fondo suave del estado (banners, chips no seleccionados). */
export function colorEstadoSuave(estado: EstadoRequisito): string {
  return color.estadoSuave[claveEstado(estado)];
}
