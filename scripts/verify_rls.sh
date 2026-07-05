#!/usr/bin/env bash
# Verifica que el aislamiento RLS multi-tenant realmente aísla, probando como un
# rol NO privilegiado (equivalente a `authenticated` en Supabase). Como owner o
# superusuario RLS se saltea, así que este test se hace bajo SET ROLE app_user.
# Salida 0 = un tenant no ve ni puede tocar datos de otro.
set -euo pipefail

export PATH="/usr/local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTN="bpa-rlstest-$$"
IMG="${BPA_PG_IMAGE:-postgres:16-alpine}"

cleanup() { docker rm -f "$CTN" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▸ Levantando Postgres efímero ($IMG)…"
docker run -d --name "$CTN" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bpa "$IMG" >/dev/null
for i in $(seq 1 30); do
  if docker exec "$CTN" pg_isready -U postgres -d bpa >/dev/null 2>&1; then break; fi
  sleep 1
done

PSQL=(docker exec -i "$CTN" psql -v ON_ERROR_STOP=1 -U postgres -d bpa -q)
echo "▸ Aplicando migraciones + seed…"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" < "$f"; done
"${PSQL[@]}" < "$ROOT"/supabase/seed/0001_bpg_vc_2026_07.sql

echo "▸ Preparando rol no privilegiado app_user (como Supabase 'authenticated')…"
"${PSQL[@]}" -c "
  create role app_user nologin;
  grant usage on schema app, bpg to app_user;
  grant select, insert, update, delete on all tables in schema app to app_user;
  grant select on all tables in schema bpg to app_user;
  grant execute on all functions in schema app, bpg to app_user;
"

echo "▸ Ejecutando escenario de aislamiento bajo RLS…"
# El tenant se fija EXCLUSIVAMENTE por el claim JWT (request.jwt.claims) — el mismo
# path que producción (Supabase inyecta el JWT en esa GUC por request). Así el test
# ejercita current_tenant() de verdad y no un atajo que prod no usa.
"${PSQL[@]}" <<'SQL'
-- helper: simula el JWT que Supabase pone en request.jwt.claims para un tenant.
create or replace function pg_temp.como_tenant(t uuid) returns void
language sql as $f$
  select set_config('request.jwt.claims', json_build_object('tenant_id', t::text)::text, true);
$f$;

do $$
declare
  tA uuid := '11111111-1111-1111-1111-111111111111';
  tB uuid := '22222222-2222-2222-2222-222222222222';
  visibles int;
begin
  set local role app_user;

  -- Fail-closed: SIN claim JWT, current_tenant() es NULL y no se ve nada.
  perform set_config('request.jwt.claims', '', true);
  select count(*) into visibles from app.establecimiento;
  if visibles <> 0 then
    raise exception 'FAIL: sin JWT se ven % filas (esperado 0, fail-closed)', visibles;
  end if;
  raise notice 'PASS: sin claim JWT no se ve nada (fail-closed)';

  -- La GUC app.tenant_id (fallback viejo) NO debe otorgar acceso: fue eliminada.
  perform set_config('app.tenant_id', tA::text, true);   -- seteable por el cliente…
  perform set_config('request.jwt.claims', '', true);    -- …pero sin JWT no alcanza.
  begin
    insert into app.establecimiento (tenant_id, nombre) values (tA, 'Via GUC');
    raise exception 'FAIL: la GUC app.tenant_id todavía otorga acceso (fallback vivo)';
  exception when check_violation or insufficient_privilege then
    raise notice 'PASS: la GUC app.tenant_id ya no es un fallback (sin JWT, RLS bloquea)';
  end;

  -- Tenant A crea un establecimiento (identificado por su JWT).
  perform pg_temp.como_tenant(tA);
  insert into app.establecimiento (tenant_id, nombre) values (tA, 'Estancia A');

  -- Tenant B crea el suyo y NO debe ver el de A.
  perform pg_temp.como_tenant(tB);
  insert into app.establecimiento (tenant_id, nombre) values (tB, 'Estancia B');
  select count(*) into visibles from app.establecimiento;
  if visibles <> 1 then
    raise exception 'FAIL: tenant B ve % filas (esperado 1, sólo la suya)', visibles;
  end if;
  if exists (select 1 from app.establecimiento where nombre = 'Estancia A') then
    raise exception 'FAIL: tenant B puede ver el establecimiento de A';
  end if;
  raise notice 'PASS: B sólo ve lo suyo';

  -- B no puede insertar filas marcadas como de A (WITH CHECK).
  begin
    insert into app.establecimiento (tenant_id, nombre) values (tA, 'Intruso');
    raise exception 'FAIL: B logró insertar una fila con tenant_id de A';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: WITH CHECK bloquea insertar con tenant ajeno';
  end;

  -- Volviendo a A, ve sólo lo suyo.
  perform pg_temp.como_tenant(tA);
  select count(*) into visibles from app.establecimiento;
  if visibles <> 1 then
    raise exception 'FAIL: tenant A ve % filas (esperado 1)', visibles;
  end if;
  raise notice 'PASS: A sólo ve lo suyo';

  reset role;
  raise notice 'RLS multi-tenant: AISLAMIENTO VERIFICADO (path JWT)';
end $$;
SQL

echo "✓ RLS multi-tenant: OK (aislamiento real bajo rol no privilegiado, path JWT)."
