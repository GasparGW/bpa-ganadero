/**
 * Generación de ids en el cliente (axioma #4: UUID de cliente para toda entidad que
 * nace offline; nunca autoincremental como clave de negocio). expo-crypto.randomUUID
 * cumple RFC 4122 v4 y no requiere red.
 */

import * as Crypto from 'expo-crypto';

export function nuevoId(): string {
  return Crypto.randomUUID();
}
