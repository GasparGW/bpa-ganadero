#!/usr/bin/env node
/**
 * Genera el seed SQL del instrumento canónico desde data/instrumento/*.json.
 * Determinista: mismo JSON -> mismo SQL. La versión se inserta con un id fijo
 * (uuidv5 sobre "instrumento:version") para que sea estable entre corridas.
 *
 *   node scripts/gen_seed_sql.mjs > supabase/seed/0001_bpg_vc_2026_07.sql
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const aqui = dirname(fileURLToPath(import.meta.url));
const root = resolve(aqui, '..');
const inst = JSON.parse(
  readFileSync(resolve(root, 'data/instrumento/bpg-vc_2026.07.json'), 'utf8'),
);

/** UUIDv5 (namespace fijo) — id estable derivado del contenido, sin deps externas. */
function uuidv5(name) {
  const ns = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex'); // NS estándar
  const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name)])).digest();
  const b = hash.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const versionId = uuidv5(`bpg:${inst.instrumento}:${inst.version}`);

const out = [];
out.push(`-- SEED generado por scripts/gen_seed_sql.mjs — NO editar a mano.`);
out.push(`-- Instrumento ${inst.instrumento} v${inst.version} · ${inst.total_requisitos} requisitos`);
out.push(`-- content_sha256 ${inst.content_sha256}`);
out.push(`begin;`);
out.push('');
out.push(`insert into bpg.instrumento_version`);
out.push(`  (id, instrumento, version, nombre, fuente, content_sha256, total_requisitos)`);
out.push(`values`);
out.push(
  `  (${q(versionId)}, ${q(inst.instrumento)}, ${q(inst.version)}, ${q(inst.nombre)}, ` +
    `${q(inst.fuente)}, ${q(inst.content_sha256)}, ${inst.total_requisitos})`,
);
out.push(`on conflict (instrumento, version) do nothing;`);
out.push('');

out.push(`insert into bpg.categoria (instrumento_version_id, codigo, nombre, orden, n_requisitos) values`);
out.push(
  inst.categorias
    .map((c, i) => `  (${q(versionId)}, ${q(c.codigo)}, ${q(c.nombre)}, ${i + 1}, ${c.n_requisitos})`)
    .join(',\n') + ';',
);
out.push('');

out.push(
  `insert into bpg.requisito (instrumento_version_id, codigo, categoria_codigo, categoria, ` +
    `seccion, orden_global, orden_categoria, texto, np, peso) values`,
);
out.push(
  inst.requisitos
    .map(
      (r) =>
        `  (${q(versionId)}, ${q(r.codigo)}, ${q(r.categoria_codigo)}, ${q(r.categoria)}, ` +
        `${q(r.seccion)}, ${r.orden_global}, ${r.orden_categoria}, ${q(r.texto)}, ${r.np}, ${r.peso})`,
    )
    .join(',\n') + ';',
);
out.push('');
out.push(`commit;`);
out.push('');

process.stdout.write(out.join('\n'));
