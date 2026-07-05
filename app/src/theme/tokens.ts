/**
 * Design tokens — GENERADO desde design/tokens.json. NO EDITAR A MANO.
 * Regenerar: npm run gen:theme (o node scripts/gen_theme_ts.mjs). CI controla el drift.
 *
 * Fuente de verdad de diseño de la dirección "Instrumento de campo": papel/tinta,
 * color sólo semántico (IT/IP/NI/NA + sync), sin elevación. Ver design/DIRECCION_ARTE.md.
 */

/** Estado de implementación de un requisito. Espejo de EstadoRequisito del dominio. */
export type Estado = 'it' | 'ip' | 'ni' | 'na';

export const color = {
  ink: "#191C1A",
  ink2: "#4A4F4A",
  paper: "#FBFAF7",
  surface: "#FFFFFF",
  line: "#D8D5CC",
  accent: "#173F2C",
  /** Color pleno del estado (texto/relleno seleccionado con blanco encima). */
  estado: {
    it: "#1B5E20",
    ip: "#8A4B00",
    ni: "#A61B1B",
    na: "#57534E",
  },
  /** Fondo suave del estado (banners, filas). */
  estadoSuave: {
    it: "#E8F2E9",
    ip: "#F5EBDD",
    ni: "#F7E7E7",
    na: "#EEEDEB",
  },
  sync: {
    pendiente: "#8A4B00",
    ok: "#1B5E20",
    error: "#A61B1B",
  },
} as const;

/** Escala tipográfica en px (cuerpo ≥ 17: pantalla de campo, no desktop). */
export const escala = {
  display: 34,
  titulo: 24,
  subtitulo: 19,
  cuerpo: 17,
  label: 15,
  micro: 13,
} as const;

/** Familias tipográficas (claves de fuente cargadas por expo-font en ui/fonts.ts). */
export const familia = {
  ui: "Archivo",
  display: "Archivo Expanded",
  mono: "IBM Plex Mono",
} as const;

/** Escala de espaciado (grilla de 4pt). */
export const espaciado = [4,8,12,16,24,32,48,64] as const;

export const radios = {
  control: 4,
  tarjeta: 6,
  chip: 999,
} as const;

/** Tamaños táctiles mínimos en dp (uso con guantes). */
export const tacto = {
  minimo: 48,
  estado: 64,
} as const;

/** Blanco de texto sobre superficies de color (siglas de estado seleccionadas). */
export const sobreColor = '#FFFFFF';
