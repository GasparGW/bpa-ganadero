#!/usr/bin/env node
// Genera app/src/theme/tokens.ts a partir de design/tokens.json.
//
// design/tokens.json es la ÚNICA fuente de verdad de diseño (mandato de la
// dirección de arte). Este generador la baja a un módulo TS tipado y congelado
// que consume la UI de React Native. No editar el .ts a mano: se regenera y CI
// controla el drift (git diff --exit-code), igual que el instrumento empaquetado.
//
// Uso: node scripts/gen_theme_ts.mjs   (o: npm run gen:theme desde app/)
//
// Se emiten los tokens que se consumen como valores de StyleSheet (color, escala,
// familia, espaciado, radios, tacto). Se OMITEN a propósito, porque no son valores
// de estilo sino guía o metadata aplicada en código:
//   - tipografia.numeros ("tabular-nums siempre") → se aplica como fontVariant en los
//     estilos numéricos (ver ResultadoPartes/EncabezadoEval/SyncChip), no es un token.
//   - iconos.stroke → se pasa a los componentes de ícono cuando se agreguen.
//   - elevacion ("ninguna") → invariante de la dirección, no hay sombras que emitir.
//   - voz / licencias / notaGuantes / meta → documentación, no estilo.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design', 'tokens.json');
const OUT = join(ROOT, 'app', 'src', 'theme', 'tokens.ts');

const t = JSON.parse(readFileSync(SRC, 'utf8'));

const s = JSON.stringify; // strings con comillas dobles, escapadas

const out = `/**
 * Design tokens — GENERADO desde design/tokens.json. NO EDITAR A MANO.
 * Regenerar: npm run gen:theme (o node scripts/gen_theme_ts.mjs). CI controla el drift.
 *
 * Fuente de verdad de diseño de la dirección "Instrumento de campo": papel/tinta,
 * color sólo semántico (IT/IP/NI/NA + sync), sin elevación. Ver design/DIRECCION_ARTE.md.
 */

/** Estado de implementación de un requisito. Espejo de EstadoRequisito del dominio. */
export type Estado = 'it' | 'ip' | 'ni' | 'na';

export const color = {
  ink: ${s(t.color.ink)},
  ink2: ${s(t.color.ink2)},
  paper: ${s(t.color.paper)},
  surface: ${s(t.color.surface)},
  line: ${s(t.color.line)},
  accent: ${s(t.color.accent)},
  /** Color pleno del estado (texto/relleno seleccionado con blanco encima). */
  estado: {
    it: ${s(t.color.estado.it)},
    ip: ${s(t.color.estado.ip)},
    ni: ${s(t.color.estado.ni)},
    na: ${s(t.color.estado.na)},
  },
  /** Fondo suave del estado (banners, filas). */
  estadoSuave: {
    it: ${s(t.color.estadoSuave.it)},
    ip: ${s(t.color.estadoSuave.ip)},
    ni: ${s(t.color.estadoSuave.ni)},
    na: ${s(t.color.estadoSuave.na)},
  },
  sync: {
    pendiente: ${s(t.color.sync.pendiente)},
    ok: ${s(t.color.sync.ok)},
    error: ${s(t.color.sync.error)},
  },
} as const;

/** Escala tipográfica en px (cuerpo ≥ 17: pantalla de campo, no desktop). */
export const escala = {
  display: ${t.tipografia.escala.display},
  titulo: ${t.tipografia.escala.titulo},
  subtitulo: ${t.tipografia.escala.subtitulo},
  cuerpo: ${t.tipografia.escala.cuerpo},
  label: ${t.tipografia.escala.label},
  micro: ${t.tipografia.escala.micro},
} as const;

/** Familias tipográficas (claves de fuente cargadas por expo-font en ui/fonts.ts). */
export const familia = {
  ui: ${s(t.tipografia.ui)},
  display: ${s(t.tipografia.display)},
  mono: ${s(t.tipografia.mono)},
} as const;

/** Escala de espaciado (grilla de ${t.espaciado.base}pt). */
export const espaciado = ${s(t.espaciado.escala)} as const;

export const radios = {
  control: ${t.radios.control},
  tarjeta: ${t.radios.tarjeta},
  chip: ${t.radios.chip},
} as const;

/** Tamaños táctiles mínimos en dp (uso con guantes). */
export const tacto = {
  minimo: ${t.tacto.targetMinimoDp},
  estado: ${t.tacto.targetEstadoDp},
} as const;

/** Blanco de texto sobre superficies de color (siglas de estado seleccionadas). */
export const sobreColor = '#FFFFFF';
`;

writeFileSync(OUT, out);
console.error(`theme → ${OUT}`);
