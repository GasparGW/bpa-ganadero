#!/usr/bin/env node
/**
 * Genera el módulo TS tipado del instrumento canónico DENTRO de `app/`, para que
 * sea cargable en el runtime de React Native (Metro empaqueta .ts, no lee `data/`
 * ni `node:fs`). La fuente de verdad sigue siendo `data/instrumento/*.json`; este
 * módulo es un artefacto generado — no editarlo a mano.
 *
 *   node scripts/gen_instrumento_ts.mjs
 *
 * El test del cliente (scoring.test.ts) importa ESTE módulo y lo valida contra los
 * golden cases: así lo que se testea es exactamente lo que se empaqueta en la app.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(aquí, '..');
const VERSION = '2026.07';

const src = resolve(ROOT, `data/instrumento/bpg-vc_${VERSION}.json`);
const instrumento = JSON.parse(readFileSync(src, 'utf8'));

const outDir = resolve(ROOT, 'app/src/instrumento');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `bpg-vc_${VERSION}.ts`);

const req = (r) =>
  `  { codigo: ${JSON.stringify(r.codigo)}, categoria_codigo: ${JSON.stringify(
    r.categoria_codigo,
  )}, categoria: ${JSON.stringify(r.categoria)}, seccion: ${JSON.stringify(
    r.seccion,
  )}, orden_global: ${r.orden_global}, orden_categoria: ${r.orden_categoria}, np: ${
    r.np
  }, peso: ${r.peso}, texto: ${JSON.stringify(r.texto)} }`;

const contenido = `/**
 * ARTEFACTO GENERADO — no editar a mano.
 * Fuente: data/instrumento/bpg-vc_${VERSION}.json
 * Regenerar: node scripts/gen_instrumento_ts.mjs
 *
 * Instrumento canónico BPG-VC empaquetado para el runtime RN. Tipado contra
 * Requisito: si el JSON deja de encajar con el tipo, TypeScript rompe el build.
 */
import type { Requisito } from '../domain/types';

export const INSTRUMENTO_META = {
  instrumento: ${JSON.stringify(instrumento.instrumento)},
  version: ${JSON.stringify(instrumento.version)},
  content_sha256: ${JSON.stringify(instrumento.content_sha256)},
  total_requisitos: ${instrumento.total_requisitos},
} as const;

export const REQUISITOS: readonly Requisito[] = [
${instrumento.requisitos.map(req).join(',\n')},
];
`;

writeFileSync(out, contenido, 'utf8');
console.log(
  `${out.replace(ROOT + '/', '')}: ${instrumento.requisitos.length} requisitos, ` +
    `sha256=${instrumento.content_sha256.slice(0, 12)}…`,
);
