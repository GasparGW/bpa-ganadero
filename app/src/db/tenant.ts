/**
 * Tenant local para Sprint 1 (sin auth todavía).
 *
 * Las filas creadas offline necesitan un `tenant_id`; el servidor lo tipa como UUID
 * NOT NULL con RLS `tenant_id = current_tenant()`. Usar cadena vacía rompería doble:
 * `''` no es un UUID válido (el insert en Postgres falla con syntax error) y jamás
 * pasaría la policy. Estampamos el UUID nil como CENTINELA determinístico.
 *
 * DEUDA EXPLÍCITA (backfill obligatorio antes de encender el sync): al integrar
 * identidad, todas las filas con `tenant_id = TENANT_LOCAL` deben re-marcarse con el
 * tenant real (preservando sus UUIDs de negocio) y volver a `pendiente_sync = 1`. Sin
 * ese backfill, el server rechazaría el upload y el trabajo offline quedaría varado.
 */

export const TENANT_LOCAL = '00000000-0000-0000-0000-000000000000';
