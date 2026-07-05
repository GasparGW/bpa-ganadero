# Sprint 0 — Fundaciones verificadas

**Fecha:** 2026-07-05 · **Estado:** completo.
**Objetivo:** dejar el repo compilando, la base con el instrumento cargado y el
scoring oficial verificado en las tres capas. Ejecución pura contra un plan ya
cerrado (arquitectura, stack, scoring, golden cases, arte y tokens ya decididos).

---

## Qué se construyó

### 1. Cliente Expo / React Native
- `app/` scaffoldeado con `create-expo-app` (Expo SDK **57**, React 19.2, RN 0.86,
  TypeScript **6** en modo `strict`, New Architecture activada).
- `app.json` con identidad de marca (nombre, package `org.redbpa.ganadero`, colores
  de la dirección de arte); `eas.json` con perfiles `development` / `preview` /
  `production` para dev builds internos (APK) y store.
- Capa de dominio pura, sin dependencias de RN, testeable en Node:
  - `src/domain/types.ts` — tipos del instrumento (`Requisito`, `EstadoRequisito`,
    `ResultadoScore`, …).
  - `src/domain/scoring.ts` — **scoring canónico del cliente**: `calcularScore`,
    `indexarRequisitos`, `calcularScorePorCategoria`. Falla ruidoso ante código o
    estado desconocido (nunca puntúa sobre datos inconsistentes).
  - `src/domain/scoring.test.ts` — carga el instrumento y los golden cases desde
    `data/` y exige coincidencia exacta.

### 2. Base de datos (Supabase / Postgres)
Migraciones en `supabase/migrations/`:
- `…01_extensiones_tenancy.sql` — esquemas `app` (OLTP) y `bpg` (catálogo),
  `app.current_tenant()` (lee claim JWT `tenant_id`, con fallback a GUC para tests),
  trigger de `actualizado_en`.
- `…02_catalogo_instrumento.sql` — catálogo canónico **SCD Type 2 desde el día 1**:
  `bpg.instrumento_version` (versionado, `content_sha256`, `vigente_desde/hasta`),
  `bpg.categoria`, `bpg.requisito` (clave natural `codigo`, `peso` coherente con `np`
  por constraint). Legible por cualquier autenticado, nunca escribible desde cliente.
- `…03_oltp_evaluaciones.sql` — `establecimiento`, `persona`, `evaluacion`
  (documento-agregado: score congelado al cerrar, constraint de cierre coherente),
  `respuesta`, `evidencia` (sólo referencia; las fotos van por cola binaria). UUID
  generables en cliente offline. **RLS por tenant** en todas las tablas `app.*`.
- `…04_scoring.sql` — **scoring del servidor**: `bpg.calcular_score(jsonb, version)`
  (primitivo verificado contra golden), `app.score_evaluacion(id)` y
  `app.cerrar_evaluacion(id)` (calcula, congela e inmutabiliza).

Seed generado (determinista) desde el JSON canónico:
`supabase/seed/0001_bpg_vc_2026_07.sql` — 1 versión + 14 categorías + 320 requisitos.

### 3. Scripts
- `scripts/gen_seed_sql.mjs` — genera el seed desde `data/instrumento/*.json`
  (id de versión estable vía UUIDv5 sobre el contenido).
- `scripts/gen_golden_check_sql.mjs` — genera el chequeo SQL desde los golden cases.
- `scripts/verify_sql_scoring.sh` — Postgres efímero (Docker) → migraciones + seed →
  golden cases del servidor.
- `scripts/verify_rls.sh` — verifica el aislamiento RLS bajo un rol **no privilegiado**
  (como `authenticated` de Supabase; con owner/superuser RLS se saltea y el test sería
  un falso positivo).

### 4. CI
`.github/workflows/ci.yml` — job `app` (typecheck + tests del cliente) y job `db`
(scoring SQL + RLS en Postgres) en cada push/PR.

---

## Verificación (resultado)

| Capa | Cómo | Resultado |
|---|---|---|
| Python (referencia) | `scripts/build_instrumento.py` | genera los 8 golden cases |
| TS (cliente) | `cd app && npm test` | **10/10** (8 golden + conteo + fail-loud) |
| SQL (servidor) | `bash scripts/verify_sql_scoring.sh` | **8/8** golden + conteo 320 |
| RLS multi-tenant | `bash scripts/verify_rls.sh` | aislamiento real verificado |
| Typecheck | `cd app && npm run typecheck` | sin errores (`strict`) |

**Las tres implementaciones del scoring coinciden exactamente** sobre la misma
referencia (`data/golden_scoring.json`). Cualquier cambio futuro que las haga
divergir rompe CI.

---

## Deuda / decisiones abiertas (no bloquean el sprint)
- **Multi-establecimiento técnico/veterinario**: sigue marcado ⏳ en el spec §3
  (decisión de alcance v1).
- **Fact tables Kimball** (`fact_respuesta`, `fact_evaluacion`): el modelo dimensional
  está diseñado en el spec; la materialización/transforms van en un sprint posterior
  (Sprint 0 se concentró en OLTP + catálogo + scoring).
- **PowerSync**: pricing/licencia verificados (GO). La integración del SDK y las Sync
  Streams por tenant se implementan en el próximo sprint (slice vertical offline).
- **Fotos + GPS** (evidencia): tabla y referencia listas; la cola binaria a Storage
  es trabajo posterior.

## Próximo (Sprint 1)
Slice vertical offline sobre el diseño de `design/`: SQLite local + esquema espejo,
pantalla de evaluación (contrato `design/mockup_evaluacion.html`) con el selector de
estado, pantalla de resultado con gaps priorizados (NI×NP1), chip de sync honesto.
