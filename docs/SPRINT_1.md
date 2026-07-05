# Sprint 1 — Rebanada vertical offline

Objetivo del sprint (del spec): **un flujo completo, funcional sin señal, de punta a
punta** — crear un establecimiento, responder los 320 requisitos guardando en el
teléfono, y ver el resultado con score congelado y brechas priorizadas. Sin sync real
todavía: el chip de sincronización dice la verdad (todo queda "sin sincronizar").

## Qué entra

- **SQLite local como fuente de verdad.** Espejo del OLTP del servidor (establecimiento,
  evaluación, respuesta) con UUIDs generados en el cliente, `pendiente_sync` por fila y
  `foreign_keys = on`. Migración idempotente al abrir la base.
- **Pantalla de evaluación** — sigue el contrato visual `design/mockup_evaluacion.html` (01)
  en el subconjunto de esta rebanada: encabezado con progreso por categoría y total + chip
  de sync, requisito con su código y nivel de prioridad, selector de estado IT/IP/NI/NA de
  64dp en la zona del pulgar. Cada estado elegido se **persiste de inmediato** (cero pérdida
  silenciosa). La captura de evidencia (foto/nota) del mockup se difiere a un sprint siguiente.
- **Cierre de evaluación** congela el score con la misma aritmética exacta del servidor
  (pesos ×4, redondeo half-up) — el resultado no se recalcula al leerlo.
- **Pantalla de resultado** = contrato (02): score hero, banner de brechas (NP1 sin
  implementar + a cuánto subiría el resultado si se resuelven) y desglose por las 14
  categorías.

## Arquitectura

- **Repositorios sobre `SqlDriver`** — interfaz mínima (execAsync/runAsync/getAll/getFirst)
  satisfecha por `expo-sqlite` en el dispositivo y por `node:sqlite` en los tests. Toda
  la lógica de persistencia es SQL puro, testeable sin emulador.
- **Score y gaps son dominio puro** (`src/domain/`), sin dependencias de RN — se testean
  con Vitest. El cliente id y el timestamp (`ahora`) los provee el caller: determinismo.
- **Theme generado** desde `design/tokens.json` (`npm run gen:theme` → `src/theme/tokens.ts`),
  con drift-guard en CI igual que el instrumento. `tokens.json` es la fuente de verdad.

## Verificación

- `npm run typecheck` limpio (TS 6 strict).
- `npm test` → **30 tests**: scoring (9 golden + 4 estructurales) + 4 gaps (incluye
  desempate por orden_global) + 5 categorías (invariantes de derivación y score por
  categoría) + 8 repos sobre `node:sqlite` real (congelado de score, rechazo de re-cierre
  y de escritura sobre cerrada, honestidad de `contarPendientes`, rechazo de FK huérfana).
- CI: drift-guard de instrumento y theme + typecheck + tests (job cliente) y scoring
  SQL golden + RLS multi-tenant (job servidor).

## Deuda consciente / fuera de alcance

- **Sync real (PowerSync)** — diferido a un sprint siguiente. El modelo de dominio ya
  contempla el outbox; el chip no miente mientras tanto.
- **Identidad/auth** — `tenant_id` local = UUID nil sentinela (`00000000-…`) en Sprint 1;
  hay que backfillear al `tenant_id` real ANTES de habilitar sync (documentado en
  `db/tenant.ts`). Persona, evidencia y transporte de sync quedan fuera del espejo por ahora.
- **Fuente display "Archivo Expanded"** — el paquete estático solo trae variantes de
  peso (no el eje de ancho), así que se usa Archivo_700Bold como stand-in (con tracking
  en las siglas). El Expanded real requiere la fuente variable: diferible, no bloqueante.
- **Correr en dispositivo** requiere un dev build de EAS en la máquina de Gaspar; el
  entorno de desarrollo no ejecuta el emulador. El código está typecheckeado y con la
  lógica cubierta por tests.
