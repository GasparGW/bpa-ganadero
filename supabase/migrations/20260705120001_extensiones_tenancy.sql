-- 20260705120001 · Extensiones, esquemas y multi-tenancy (RLS).
--
-- Modelo de tenencia: cada cuenta (tenant) es un productor/empresa. Todo dato
-- operacional (app.*) lleva tenant_id y queda aislado por RLS. El catálogo del
-- instrumento (bpg.*) es referencia compartida: legible por cualquier usuario
-- autenticado, no escribible desde el cliente.
--
-- current_tenant() lee EXCLUSIVAMENTE el claim tenant_id del JWT (el mismo path en
-- producción y en tests). Sin fallback a GUC: una GUC de sesión (p. ej. app.tenant_id)
-- es seteable por el cliente y sería suplantable, además de arrastrarse entre requests
-- en poolers. Si no hay claim → devuelve NULL → RLS no matchea ninguna fila (fail-closed).
--
-- Requisito de producción: el tenant_id debe estar en el JWT. En Supabase se inyecta
-- con un Custom Access Token Hook (o app_metadata propagado al token). Esto lo maneja
-- la configuración del proyecto, no una migración.

create extension if not exists pgcrypto;   -- gen_random_uuid()

create schema if not exists app;   -- OLTP operacional (lo que sincroniza PowerSync)
create schema if not exists bpg;   -- catálogo canónico del instrumento (referencia)

create or replace function app.current_tenant()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id')::uuid
$$;

-- Trigger genérico de auditoría: mantiene actualizado_en en cada UPDATE.
create or replace function app.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
