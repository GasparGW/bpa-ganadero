/**
 * Registro del service worker — sólo web. Habilita el uso offline real que promete la
 * pantalla de inicio ("funciona sin señal"): tras la primera carga, la app y sus assets
 * quedan cacheados y abren sin conexión. En native es un no-op (expo-sqlite ya es local).
 * Falla en silencio: si el navegador no soporta SW, la app sigue andando (online).
 */

import { Platform } from 'react-native';

export function registrarServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  // Sólo en producción: en el dev server (`expo start`) el SW cachearía el bundle de dev
  // cache-first y rompería el hot reload. `__DEV__` es false en el export (`build:web`),
  // así que el SW sí se registra en el sitio desplegado y en los E2E (que corren sobre el
  // export estático, no sobre el dev server).
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window === 'undefined') return;

  // Pide almacenamiento durable: sin esto, algunos navegadores (Safari/iOS en particular)
  // evictan la cache del SW y la base en IndexedDB tras ~7 días de inactividad o bajo presión
  // de almacenamiento — justo el caso "cargo una vez y vuelvo semanas después". No abre prompt
  // en la mayoría de navegadores y si no está soportado es un no-op; falla en silencio.
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    void navigator.storage.persist().catch(() => {});
  }

  const registrar = (): void => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin SW la app funciona igual online; no rompemos el arranque por esto.
    });
  };

  // Registrar tras 'load' para no competir con el arranque (apertura de base + fuentes).
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar);
}
