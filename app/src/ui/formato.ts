/**
 * Formateo numérico es-AR: separador de miles "." y decimal ",". Sin Intl (el
 * soporte en Hermes es parcial): implementación explícita y determinista.
 */

function separarMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Porcentaje con 1 decimal fijo. `null` → guion largo. Ej.: 67.42 → "67,4". */
export function pct(n: number | null): string {
  if (n === null) return '—';
  const r = (Math.round(n * 10) / 10).toFixed(1);
  const [e, d] = r.split('.');
  return `${separarMiles(e)},${d}`;
}

/** Puntos: hasta 1 decimal, sin decimal si es entero. Ej.: 2445 → "2.445", 1648.5 → "1.648,5". */
export function puntos(n: number): string {
  const r = Math.round(n * 10) / 10;
  const e = Math.trunc(r);
  const d = Math.abs(Math.round((r - e) * 10));
  const base = separarMiles(String(e));
  return d === 0 ? base : `${base},${d}`;
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Fecha corta es-AR en mayúsculas. Ej.: "2026-07-05T…" → "05-JUL-2026". */
export function fechaCorta(iso: string | null): string {
  if (iso === null) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}-${d.getFullYear()}`;
}
