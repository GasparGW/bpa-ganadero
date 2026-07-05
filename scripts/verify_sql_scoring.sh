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

echo "✓ Scoring SQL del servidor: OK contra golden cases."
