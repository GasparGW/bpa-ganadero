# Análisis GANADATA — ¿extraer o empezar de cero?

**Fecha:** 2026-07-04. Análisis profundo de `~/projects/ganadata` (web, Next.js 16 +
Supabase) y `~/ganadata-mobile` (Expo SDK 54), verificados en vivo (install, typecheck,
tests corridos).

## Veredicto

**Producto separado, repo nuevo, con extracción selectiva de ~8 piezas. Ni módulo de
ganadata ni fork. GANADATA es una cantera, no unos cimientos.**

La razón central: los dos requisitos duros de la app nueva — **offline-first real** y
**el instrumento BPG-VC general (320 req / 14 categorías)** — son exactamente las dos
cosas que GANADATA no tiene. Lo que GANADATA sí tiene (warehouse ganadero RFID/pesajes/
SENASA de 17 fact tables) es lo que un autodiagnóstico BPG no necesita.

## Estado de los repos (verificado)

| | ganadata (web) | ganadata-mobile |
|---|---|---|
| Actividad | feb–abr 2026, dormido 3 meses | 4 commits (11-12 mar 2026), dormido 4 meses |
| Tamaño | 21.4k líneas TS, 58 migraciones SQL | 12 pantallas (5 placeholder) |
| Calidad | Deploy Vercel+Sentry real; coverage 12.6% | Compila, 35 tests pasan, CI real |
| Validación real | **30 evaluaciones BPG reales** (visita Don Aquiles/Agropemar, ene 2026) | Solo mock (BLE sin hardware validado) |
| Offline | **0%** — solo manifest.json, ADR aspiracional | Sync engine escrito pero **desconectado** (useSync jamás importado); captura local OK, push nunca corre |

## Hallazgos clave

1. **El instrumento seedeado es el equivocado**: `dim_requisito_bpg` tiene 187
   requisitos de la guía **feedlot** (BPG-VCF), todos NP1 (pesos sin ejercitar).
   La guía general BPG-VC (nuestros 320) tiene 0 filas. No hay conflicto 187 vs 320:
   son instrumentos distintos.
2. **El scoring sí está validado y corregido**: `000058_audit_and_integrity.sql` tiene
   la versión final de `calcular_score_bpg` (pesos NP exactos Red BPA, DISTINCT ON por
   requisito, criticidad, bloqueo de certificación). La versión previa (000035) tenía
   un bug real — usar solo la final.
3. **`fact_auditoria_bpg` necesita rediseño**: no tiene entidad "sesión/autodiagnóstico"
   padre, ni versionado del instrumento (si la Comisión cambia la guía, el histórico se
   corrompe), ni cierre/firma. Y usa SERIAL keys + resolución server-side de tiempo_key
   — incompatible con cola offline (necesitamos UUIDs client-generated e idempotencia).
4. **La UI BPG existente es online-only con silent fail**: guarda fetch-por-requisito y
   si se corta la señal pierde respuestas sin avisar. Antítesis del requisito de campo.
5. **El sync del mobile nunca corrió**: buenas ideas (NetInfo, backoff, upsert
   idempotente) pero desenchufado, "LWW" falso (overwrite incondicional), descarte
   silencioso de datos, N+1 de red por lectura. Sirve de referencia, no de base.
6. **Sí hay identidad visual embrionaria propia** (no genérica): verde estancia
   `#1B3B2F`, gold `#C8963E`, cream `#FAF8F5`, Inter/Playfair — coherente en ambos
   repos. Decisión de marca pendiente: ¿continuidad GANADATA o marca nueva?
7. **La Guía General BPG-VC apareció** en el archive de rag-bpg-project (PDF + txt
   procesado) → copiada a `docs/`. Con ella se validaron los 2 ítems inferidos de la
   curación (ver `curacion_checklist.md`).

## Inventario de extracción (qué sí llevamos)

| Pieza | Origen | Destino/uso |
|---|---|---|
| `calcular_score_bpg` final (matemática Red BPA validada) | ganadata `supabase/migrations/000058` | Adaptar al modelo nuevo con sesión+versión |
| DDL `dim_requisito_bpg` + patrón seed idempotente | `000010` (l.66-83), `000031`, `000032` | Base del modelo del instrumento |
| Patrón RLS multi-tenant completo (sobrevivió auditorías) | `000007`, `000015`, `000022`, `000024`, `000042` | Plantilla de seguridad |
| `audit_log` JSONB genérico | `000058` | Auditoría de cambios |
| Design tokens (si se decide continuidad de marca) | `src/app/globals.css` + mobile `tailwind.config.js` | Punto de partida de dirección de arte |
| Cliente SQLite+Drizzle (WAL) + Supabase client (SecureStore) + AuthContext + CI jest RN | mobile `src/db/client.ts`, `src/lib/supabase.ts`, `src/context/AuthContext.tsx`, `.github/workflows/ci.yml` | ~medio día de porteo |
| Patrón outbox `sync_queue` + upsert `onConflict` idempotente | mobile `src/db/schema.ts` + `sync-engine.ts` | Referencia para el sync real (implementar en serio) |
| Docs de dominio: integración BPG↔datos, research SENASA ("no hay API"), estado honesto | ganadata `docs/domain/*` | Research no repetible |
| Informes visita Don Aquiles + 30 evaluaciones reales | ganadata `docs/bpg/don-aquiles/` + DB | Caso de validación / usuario piloto |
| Guía General BPG-VC (PDF + txt) | rag-bpg-project archive | Ya copiada a `docs/` |

## Qué NO llevamos y por qué

- **La app web como base**: acoplada al warehouse ganadero completo, server-first
  incompatible con offline, 14 fact tables sin UI, silent-fail en campo.
- **El seed de 187 requisitos**: es feedlot y todo NP1; nuestro instrumento son los 320
  curados en `app.html` (+ datasets feedlot/transporte propios ya extraídos).
- **`fact_auditoria_bpg` tal cual**: rediseñar como `dim_instrumento_version` (SCD2
  sobre el checklist) + `fact_respuesta_autodiagnostico` (grano respuesta×sesión) +
  header de sesión con estado y score congelado.
- **El sync engine tal cual**: el modelo dirty-flag por fila no encaja; una evaluación
  BPG es un documento con progreso parcial que se sincroniza como agregado versionado.
- **Pantallas/NL2SQL/predicciones**: valiosas para ganadata, ruido para este MVP.

## Lecciones de diseño que GANADATA nos deja (pagadas con trabajo real)

1. Versionar el instrumento desde el día 1 (SCD2) — la lección que ganadata no aprendió.
2. UUIDs generados en cliente, nunca SERIAL, para todo lo que nace offline.
3. El sync se diseña y se **cablea** primero, no al final (dos repos lo postergaron).
4. Sin entidad "sesión de evaluación" el modelo mezcla foto actual con histórico.
5. Silent-fail en guardado de campo = pérdida de datos garantizada.
6. Desarrollo LLM sin auditoría acumula fixes: presupuestar ciclos de auditoría.
