-- 20260705120001 · Extensiones, esquemas y multi-tenancy (RLS).
--
-- Modelo de tenencia: cada cuenta (tenant) es un productor/empresa. Todo dato
-- operacional (app.*) lleva tenant_id y queda aislado por RLS. El catálogo del
-- instrumento (bpg.*) es referencia compartida: legible por cualquier usuario
-- autenticado, no escribible desde el cliente.
--
-- current_tenant() lee el claim tenant_id del JWT (producción, PowerSync/Supabase)
-- con fallback a la GUC app.tenant_id (para tests locales via `SET app.tenant_id`).

create extension if not exists pgcrypto;   -- gen_random_uuid()

create schema if not exists app;   -- OLTP operacional (lo que sincroniza PowerSync)
create schema if not exists bpg;   -- catálogo canónico del instrumento (referencia)

create or replace function app.current_tenant()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id',
    nullif(current_setting('app.tenant_id', true), '')
  )::uuid
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
