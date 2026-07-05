# BPA Ganadero

Plataforma para autodiagnóstico e implementación de Buenas Prácticas Agropecuarias (BPA) en producción bovina.

## Contexto

En Argentina no existe ninguna herramienta que permita al productor ganadero:
- Autoevaluarse contra el estándar BPA (321 requisitos, 14 categorías)
- Generar un plan de implementación priorizado desde el diagnóstico
- Conectar ese diagnóstico con el proceso de certificación formal (IRAM 14110, GlobalGAP, Aapresid)

Las auditorías actuales son papel/Excel. La única app oficial (SAGyP+COVIAR) es exclusiva para técnicos intermediarios registrados en RENATBPA. La Resolución 71/2024 mandó trazabilidad electrónica obligatoria para todos los bovinos (julio 2026) pero no cubre BPA.

## Estado

**Sprint 0 completo** — fundaciones verificadas. Ver `docs/SPRINT_0.md`.

- Cliente Expo/RN scaffoldeado (SDK 57, TS strict).
- Scoring oficial implementado en 3 capas (Python ref · TS cliente · SQL servidor),
  las tres validadas contra los 8 golden cases de `data/golden_scoring.json`.
- Base de datos: migraciones Kimball + OLTP + RLS multi-tenant, instrumento
  canónico (320 requisitos) seedeado. Aislamiento RLS verificado bajo rol no
  privilegiado.
- CI (GitHub Actions) corre typecheck + tests del cliente y verificación
  SQL/RLS en Postgres.

## Stack

- **Cliente:** Expo / React Native (dev builds EAS), TypeScript strict, SQLite local
  como fuente de verdad (offline-first).
- **Sync:** PowerSync sobre Supabase (RLS autoritativa, documento-agregado por evaluación).
- **Datos:** Postgres con esquemas Kimball (`bpg` catálogo · `app` OLTP), fotos por
  cola binaria a Supabase Storage.
- Decisiones fundamentadas en `docs/SPEC_ARQUITECTURA.md`; identidad visual en `design/`.

## Layout del repo

```
app/                  cliente Expo/RN (dominio + scoring verificado)
supabase/migrations/  esquema Kimball + OLTP + RLS + scoring SQL
supabase/seed/        instrumento canónico seedeado (generado)
scripts/              build del instrumento, generadores de seed, verificadores
data/                 instrumento canónico + golden cases
design/               dirección de arte + tokens + mockup (contrato visual)
docs/ research/       spec de arquitectura, contexto institucional, landscape
```

## Verificar

```bash
cd app && npm ci && npm run typecheck && npm test   # cliente + scoring golden
bash scripts/verify_sql_scoring.sh                  # scoring SQL vs golden (Docker)
bash scripts/verify_rls.sh                          # aislamiento RLS multi-tenant (Docker)
```
