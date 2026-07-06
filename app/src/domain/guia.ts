/**
 * Contenido de guía por requisito (build-time, revisado a mano, bundleado offline).
 *
 * Espinazo de procedencia: cada afirmación declara su fuente. `cita` es rastreable a
 * un ítem VERIFICADO de la guía oficial (`fuente: guia`). `nivel_esfuerzo` es una
 * estimación EDITORIAL nuestra, NO doctrina de la Red BPA (la palabra "esfuerzo" no
 * aparece en la guía) — se etiqueta como tal y nunca se presenta como dato de la guía.
 *
 * El runtime que consume esto (plan.ts) es puro y determinístico: no llama a ningún
 * modelo. El LLM sólo interviene en build-time, al autorar el contenido.
 */

/** Estimación editorial del esfuerzo de implementación. NO está en la guía oficial. */
export type NivelEsfuerzo = 'bajo' | 'medio' | 'alto';

/**
 * Cobertura del contenido de un requisito:
 *   - `curada`: pasos + evidencia + cita a ítem específico, revisado a mano.
 *   - `derivada`: sólo contexto de categoría + cita a nivel categoría. SIN pasos
 *     inventados (la guía no tiene guía específica para este ítem todavía).
 */
export type EstadoGuia = 'curada' | 'derivada';

/** Cita a la guía oficial. `item` es null en `derivada` (cita a nivel de categoría). */
export interface CitaGuia {
  readonly seccion: string;
  /**
   * Ítem(s) N.M VERIFICADO(s) contra la guía. Uno solo ("3.1") o varios separados por
   * coma ("13.1, 13.5") cuando los pasos se apoyan en ítems contiguos de la sección.
   * Curado a mano (no derivable de orden_categoria).
   */
  readonly item: string | null;
}

/** Contenido de guía de un requisito. Forma espejo de `data/guia/*.json`. */
export interface GuiaRequisito {
  readonly codigo: string;
  readonly estado: EstadoGuia;
  /**
   * Pasos accionables. Sólo poblado en `curada`; en `derivada` va vacío — no se
   * inventan pasos que la guía no respalda.
   */
  readonly como_implementar: readonly string[];
  /** Qué registro/foto sirve de prueba. `null` si no curado. */
  readonly evidencia_sugerida: string | null;
  readonly cita: CitaGuia;
  /** Estimación EDITORIAL nuestra (no doctrina). `null` si no estimada. */
  readonly nivel_esfuerzo: NivelEsfuerzo | null;
}

/**
 * Rango de esfuerzo para el ORDEN del plan (menor = antes: "ganancia rápida" primero).
 * Un requisito sin esfuerzo estimado (`null`) ordena DESPUÉS de `alto`: lo que no
 * estimamos no debe saltar al frente como si fuera fácil. Total y determinístico.
 */
export function rangoEsfuerzo(nivel: NivelEsfuerzo | null): number {
  switch (nivel) {
    case 'bajo':
      return 0;
    case 'medio':
      return 1;
    case 'alto':
      return 2;
    default:
      return 3; // sin estimar
  }
}

/** Índice código → guía, análogo a `indexarRequisitos`. Falla ante código duplicado. */
export function indexarGuia(
  entradas: readonly GuiaRequisito[],
): ReadonlyMap<string, GuiaRequisito> {
  const m = new Map<string, GuiaRequisito>();
  for (const g of entradas) {
    if (m.has(g.codigo)) {
      throw new Error(`Entrada de guía duplicada: ${g.codigo}`);
    }
    m.set(g.codigo, g);
  }
  return m;
}
