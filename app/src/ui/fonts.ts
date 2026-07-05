/**
 * Carga de fuentes de la dirección "Instrumento de campo".
 *
 * Archivo (Omnibus-Type, fundidora argentina) como familia UI; IBM Plex Mono para
 * códigos y datos de registro. NOTA de fidelidad: el paquete estático de Archivo no
 * incluye el eje de ancho (width), así que "Archivo Expanded" (display, wdth 125%
 * del mockup) se aproxima con Archivo_700Bold + tracking. El Expanded real requiere
 * la fuente variable (deferible; no bloquea Sprint 1).
 */

import {
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

/** fontFamily reales cargadas. `display` aproxima Expanded (ver nota del módulo). */
export const fuente = {
  ui: 'Archivo_400Regular',
  uiFuerte: 'Archivo_600SemiBold',
  display: 'Archivo_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

/**
 * Estado de carga de fuentes. `[listas, error]`. El error se PROPAGA (no se descarta):
 * la app degrada a la fuente del sistema en vez de quedar colgada en el gate para
 * siempre si un asset fallara. Las fuentes son assets empaquetados, así que el fallo
 * es improbable — pero nunca debe bloquear indefinidamente.
 */
export function useAppFonts(): readonly [boolean, Error | null] {
  const [cargadas, error] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexMono_500Medium,
  });
  return [cargadas, error ?? null];
}
