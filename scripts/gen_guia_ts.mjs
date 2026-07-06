#!/usr/bin/env node
/**
 * Genera el módulo TS tipado del contenido de guía DENTRO de `app/`, para que sea
 * cargable en el runtime de React Native (Metro empaqueta .ts, no lee `data/` ni
 * `node:fs`). La fuente de verdad sigue siendo `data/guia/*.json`; este módulo es un
 * artefacto generado — no editarlo a mano.
 *
 *   node scripts/gen_guia_ts.mjs
 *
 * El test del cliente (guia/index.test.ts) importa ESTE módulo y valida que cada
 * entrada exista en el instrumento y que las citas estén bien formadas: así lo que se
 * testea es exactamente lo que se empaqueta en la app.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(aquí, '..');
const VERSION = '2026.07';

const src = resolve(ROOT, `data/guia/bpg-vc_${VERSION}.json`);
const guia = JSON.parse(readFileSync(src, 'utf8'));

const outDir = resolve(ROOT, 'app/src/guia');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `bpg-vc_${VERSION}.ts`);

const lista = (xs) => `[${xs.map((s) => JSON.stringify(s)).join(', ')}]`;

const entrada = (g) =>
  `  {\n` +
  `    codigo: ${JSON.stringify(g.codigo)},\n` +
  `    estado: ${JSON.stringify(g.estado)},\n` +
  `    como_implementar: ${lista(g.como_implementar)},\n` +
  `    evidencia_sugerida: ${JSON.stringify(g.evidencia_sugerida)},\n` +
  `    cita: { seccion: ${JSON.stringify(g.cita.seccion)}, item: ${JSON.stringify(g.cita.item)} },\n` +
  `    nivel_esfuerzo: ${JSON.stringify(g.nivel_esfuerzo)},\n` +
  `  }`;

const contenido = `/**
 * ARTEFACTO GENERADO — no editar a mano.
 * Fuente: data/guia/bpg-vc_${VERSION}.json
 * Regenerar: node scripts/gen_guia_ts.mjs
 *
 * Contenido de guía por requisito, empaquetado para el runtime RN. Tipado contra
 * GuiaRequisito: si el JSON deja de encajar con el tipo, TypeScript rompe el build.
 */
import type { GuiaRequisito } from '../domain/guia';

export const GUIA_META = {
  instrumento: ${JSON.stringify(guia.instrumento)},
  version: ${JSON.stringify(guia.version)},
  fuente: ${JSON.stringify(guia.fuente)},
  total_entradas: ${guia.entradas.length},
} as const;

export const GUIA: readonly GuiaRequisito[] = [
${guia.entradas.map(entrada).join(',\n')},
];
`;

writeFileSync(out, contenido, 'utf8');
console.log(
  `${out.replace(ROOT + '/', '')}: ${guia.entradas.length} entradas de guía ` +
    `(${guia.entradas.filter((g) => g.estado === 'curada').length} curadas)`,
);
