#!/usr/bin/env bash
# Verifica el scoring SQL del servidor contra los golden cases en un Postgres
# efímero (Docker). Aplica migraciones + seed, corre el check generado y limpia.
# No deja nada corriendo. Salida 0 = todos los golden cases del servidor pasaron.
set -euo pipefail

export PATH="/usr/local/bin:$PATH"   # docker-credential-desktop (shell no-login)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTN="bpa-pgtest-$$"
IMG="${BPA_PG_IMAGE:-postgres:16-alpine}"

cleanup() { docker rm -f "$CTN" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▸ Levantando Postgres efímero ($IMG)…"
docker run -d --name "$CTN" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bpa "$IMG" >/dev/null

echo "▸ Esperando readiness…"
for i in $(seq 1 30); do
  if docker exec "$CTN" pg_isready -U postgres -d bpa >/dev/null 2>&1; then break; fi
  sleep 1
done

PSQL=(docker exec -i "$CTN" psql -v ON_ERROR_STOP=1 -U postgres -d bpa -q)

echo "▸ Aplicando migraciones…"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  · $(basename "$f")"
  "${PSQL[@]}" < "$f"
done

echo "▸ Aplicando seed del instrumento…"
"${PSQL[@]}" < "$ROOT"/supabase/seed/0001_bpg_vc_2026_07.sql

echo "▸ Chequeo de conteo (esperado 320 requisitos)…"
"${PSQL[@]}" -c "do \$\$ begin
  if (select count(*) from bpg.requisito) <> 320 then
    raise exception 'Conteo de requisitos != 320: %', (select count(*) from bpg.requisito);
  end if;
  raise notice 'PASS conteo=320';
end \$\$;"

echo "▸ Corriendo golden cases del servidor…"
node "$ROOT"/scripts/gen_golden_check_sql.mjs | "${PSQL[@]}"

echo "▸ Ciclo de vida: rechazo de código huérfano + cierre de evaluación todo-NA…"
"${PSQL[@]}" <<'SQL'
do $$
declare
  vid uuid;
  est uuid := gen_random_uuid();
  ev  uuid;
  t   uuid := '33333333-3333-3333-3333-333333333333';
  cerrada app.evaluacion;
  codigo1 text;
begin
  select id into vid from bpg.instrumento_version where vigente_hasta is null limit 1;
  insert into app.establecimiento (id, tenant_id, nombre) values (est, t, 'Est Test');
  insert into app.evaluacion (tenant_id, establecimiento_id, instrumento_version_id)
    values (t, est, vid) returning id into ev;

  -- (#4) una respuesta con código inexistente en la versión debe rechazarse.
  begin
    insert into app.respuesta (tenant_id, evaluacion_id, requisito_codigo, estado)
      values (t, ev, 'XXX-999', 'IT');
    raise exception 'FAIL: se aceptó una respuesta con código huérfano';
  exception when others then
    if sqlerrm not like '%no existe en la versión%' then raise; end if;
    raise notice 'PASS: código huérfano rechazado por el trigger';
  end;

  -- (#7) una respuesta con tenant distinto al de su evaluación debe rechazarse.
  begin
    select codigo into codigo1 from bpg.requisito
      where instrumento_version_id = vid order by orden_global limit 1;
    insert into app.respuesta (tenant_id, evaluacion_id, requisito_codigo, estado)
      values ('44444444-4444-4444-4444-444444444444', ev, codigo1, 'IT');
    raise exception 'FAIL: se aceptó una respuesta con tenant ajeno al de la evaluación';
  exception when others then
    if sqlerrm not like '%no coincide%' then raise; end if;
    raise notice 'PASS: tenant inconsistente rechazado por el trigger';
  end;

  -- (#3) evaluación con todo NA: score indefinido, pero DEBE poder cerrarse.
  insert into app.respuesta (tenant_id, evaluacion_id, requisito_codigo, estado)
    values (t, ev, codigo1, 'NA');
  select * into cerrada from app.cerrar_evaluacion(ev);
  if cerrada.estado <> 'cerrada' then
    raise exception 'FAIL: la evaluación todo-NA no se cerró';
  end if;
  if cerrada.score_pct is not null then
    raise exception 'FAIL: score_pct debería ser NULL en todo-NA, fue %', cerrada.score_pct;
  end if;
  raise notice 'PASS: evaluación todo-NA cerrada con score_pct NULL';
end $$;
SQL

echo "▸ SCD2: transición de versión válida + bloqueo de cero-vigentes…"
# Transición v_n → v_{n+1} en UNA transacción: cerrar la vigente e insertar la nueva.
# Debe pasar (el trigger diferido chequea al commit, cuando ya hay 1 vigente).
"${PSQL[@]}" <<'SQL'
begin;
update bpg.instrumento_version set vigente_hasta = current_date
  where instrumento = 'BPG-VC' and vigente_hasta is null;
insert into bpg.instrumento_version (instrumento, version, nombre, content_sha256, total_requisitos)
  values ('BPG-VC', '2099.01', 'transición test', 'x', 320);
commit;
SQL
echo "  PASS: transición v→v+1 en una transacción"

# Dejar el instrumento con CERO versiones vigentes debe fallar al commit.
if docker exec -i "$CTN" psql -v ON_ERROR_STOP=1 -U postgres -d bpa -q 2>/dev/null <<'SQL'
begin;
update bpg.instrumento_version set vigente_hasta = current_date
  where instrumento = 'BPG-VC' and vigente_hasta is null;
commit;
SQL
then
  echo "  FAIL: se permitió dejar el instrumento sin ninguna versión vigente" && exit 1
else
  echo "  PASS: cero-vigentes bloqueado al commit (constraint trigger diferido)"
fi

echo "✓ Scoring SQL del servidor: OK contra golden cases + ciclo de vida + SCD2."
