#!/usr/bin/env node
/**
 * Genera un bloque SQL que corre bpg.calcular_score sobre cada golden case y
 * lanza excepción ante cualquier divergencia. Si psql lo ejecuta sin error,
 * el scoring del servidor reproduce exactamente data/golden_scoring.json.
 *
 *   node scripts/gen_golden_check_sql.mjs > /tmp/golden_check.sql
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const root = resolve(aqui, '..');
const golden = JSON.parse(readFileSync(resolve(root, 'data/golden_scoring.json'), 'utf8'));

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lines = [];
lines.push(`do $$`);
lines.push(`declare r record; vid uuid;`);
lines.push(`begin`);
lines.push(
  `  select id into vid from bpg.instrumento_version where instrumento=${q(golden.instrumento)} and version=${q(golden.version_instrumento)};`,
);
lines.push(`  if vid is null then raise exception 'No se encontró la versión del instrumento seedeada'; end if;`);

for (const c of golden.casos) {
  const respuestasJson = q(JSON.stringify(c.respuestas));
  const e = c.esperado;
  const condPuntos = `r.puntos_obtenidos = ${e.puntos_obtenidos}`;
  const condMax = `r.maximo_aplicable = ${e.maximo_aplicable}`;
  const condPct =
    e.score_pct === null ? `r.score_pct is null` : `r.score_pct = ${e.score_pct}`;
  lines.push(``);
  lines.push(`  select * into r from bpg.calcular_score(${respuestasJson}::jsonb, vid);`);
  lines.push(`  if not (${condPuntos} and ${condMax} and ${condPct}) then`);
  lines.push(
    `    raise exception 'GOLDEN FAIL ${c.nombre}: obtuvo pts=% max=% pct=% (esperado ${e.puntos_obtenidos}/${e.maximo_aplicable}/${e.score_pct})', r.puntos_obtenidos, r.maximo_aplicable, r.score_pct;`,
  );
  lines.push(`  end if;`);
  lines.push(`  raise notice 'PASS ${c.nombre}';`);
}

lines.push(``);
lines.push(`  raise notice 'TODOS los golden cases del servidor PASARON (${golden.casos.length})';`);
lines.push(`end $$;`);
lines.push(``);

process.stdout.write(lines.join('\n'));
