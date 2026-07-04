# SPEC de Arquitectura — BPA Ganadero

**Versión:** 0.1 (borrador) — 2026-07-04
**Estado:** dominio y modelo de datos definidos; elecciones de stack PENDIENTES del
deep research SOTA (secciones marcadas ⏳).

---

## 1. Visión

Sistema de datos de adopción de BPG de Argentina, enmarcado en la "nueva etapa" de la
Red BPA (Comisión de Ganadería). La app de campo es el punto de captura; el warehouse
dimensional es el activo. Cadena de valor:

```
Autodiagnóstico offline → Score + gaps priorizados (NI×NP1) → Plan de acción con guía
→ Seguimiento en el tiempo → Export a auditoría formal → Indicadores de resultado (Red)
```

## 2. Axiomas de diseño (no negociables)

1. **Local-first**: la fuente de verdad vive en el dispositivo (SQLite). La app es 100%
   funcional sin señal por semanas. El sync es oportunista, nunca requisito.
2. **El instrumento es oficial y versionado**: los 320 requisitos son de la Comisión.
   Todo cambio del instrumento crea una versión nueva; el histórico jamás se corrompe
   (SCD2 sobre `dim_requisito` / `dim_instrumento_version`).
3. **Cero pérdida silenciosa**: todo guardado es local-primero y confirmado; el estado
   de sync es siempre visible. Nunca silent-fail (lección GANADATA).
4. **UUIDs generados en cliente** para toda entidad que nace offline. Nada de SERIAL
   como clave de negocio. Sync idempotente (upsert con claves naturales).
5. **Diseño para el campo**: pleno sol, guantes, apuro, gama media, baja alfabetización
   digital. Identidad visual propia — cero estética genérica.
6. **El modelo local nace mapeado al warehouse**: cada evaluación es un hecho analítico
   futuro. Sin retrabajo de modelado entre captura y analytics.

## 3. Actores y alcance del MVP

| Actor | MVP | Post-MVP |
|---|---|---|
| **Productor / encargado** | ✅ autodiagnóstico, score, gaps, historial propio | plan de acción guiado, capacitación |
| **Técnico / veterinario** | ⏳ decidir: ¿multi-establecimiento en v1? | evaluación de terceros, comparativas de cartera |
| **Comisión / Red BPA** | — | dashboard agregado, indicadores de resultado |
| **Auditor externo** | — | export formato IRAM/GlobalGAP, evidencia verificable |

**Tajada vertical del MVP (propuesta):** un usuario crea un establecimiento, completa
un autodiagnóstico de 320 requisitos 100% offline (con pausas/reanudación), adjunta
evidencia (foto+GPS) opcional por requisito, cierra la evaluación (score congelado),
ve score global y por categoría con gaps priorizados, y sincroniza cuando hay señal.
Historial de evaluaciones para ver trayectoria.

## 4. Modelo de dominio

### Entidades OLTP (cliente y servidor)

```
Establecimiento (uuid, renspa?, nombre, ubicación, sistema_productivo, escala)
Persona (uuid, rol: productor|encargado|tecnico|..., auth_id)
InstrumentoVersion (uuid, codigo: "BPG-VC", version: "2026.07", vigente_desde, fuente)
Requisito (uuid, instrumento_version_fk, categoria, seccion, orden, texto, np: 1|2|3)
Evaluacion (uuid_cliente, establecimiento_fk, evaluador_fk, instrumento_version_fk,
            estado: abierta|cerrada, iniciada_en, cerrada_en,
            score_congelado?, device_id)
Respuesta (uuid_cliente, evaluacion_fk, requisito_fk,
           estado: IT|IP|NI|NA, observacion?, respondida_en_device, actualizada_en)
Evidencia (uuid_cliente, respuesta_fk, tipo: foto, uri_local, hash, lat?, lon?,
           capturada_en_device, sync_estado)
```

Reglas:
- Una `Evaluacion` es un **documento-agregado**: se sincroniza como unidad lógica
  (evaluación + respuestas + refs a evidencias), no fila por fila.
- `Respuesta` es upsert local mientras la evaluación está abierta (última gana dentro
  del mismo device); al cerrar, la evaluación se vuelve inmutable y el score se congela.
- Scoring (oficial Red BPA): `score = Σ(peso_np × mult_estado) / Σ(peso_np | estado≠NA) × 100`
  con NP1=10, NP2=5, NP3=2.5; IT=1.0, IP=0.5, NI=0. Se calcula igual en cliente
  (feedback inmediato) y servidor (fuente canónica al proyectar) — misma spec, dos
  implementaciones testeadas contra los mismos casos dorados.

### Sync (esbozo — ⏳ mecanismo concreto según research)

- **Outbox local**: cola de cambios pendientes con reintentos con backoff, visible en UI
  ("N cambios sin sincronizar").
- Push idempotente (claves = uuid cliente); pull de catálogos (instrumento, requisitos)
  versionado y raramente cambiante — embebido en el binario + actualizable.
- Conflictos: raros por diseño (una evaluación pertenece a un device/evaluador). Regla
  simple documentada para el caso borde (misma evaluación editada en dos devices):
  ⏳ definir con el engine elegido.

### Warehouse Kimball (servidor)

```
Schemas: staging → dimensions → facts → analytics   (convención heredada de GANADATA)

dim_tiempo, dim_establecimiento, dim_persona
dim_instrumento_version              ← versiones del checklist
dim_requisito (SCD2, FK a versión)   ← categoria/seccion/np como atributos

fact_respuesta        grano: respuesta × evaluación CERRADA
                      (estado, peso, puntos_obtenidos, flags evidencia)
fact_evaluacion       grano: evaluación cerrada (score total, score×categoría,
                      duración, % completitud, n_evidencias)
[futuro] fact_indicador_resultado    ← indicadores generales/específicos de la Red
                      (sets sustentabilidad económico-productiva/ambiental/social)
```

- Solo evaluaciones **cerradas** entran a facts (las abiertas son estado operacional).
- RLS multi-tenant por establecimiento (patrón GANADATA 000007/000015/000042).
- Scoring canónico servidor: adaptar `calcular_score_bpg` de GANADATA 000058
  (versión final, no 000035) al grano evaluación-sesión.

## 5. Decisiones de stack — ⏳ PENDIENTE deep research SOTA (en curso)

| Decisión | Candidatos | Criterio de corte |
|---|---|---|
| Plataforma cliente | Expo/RN vs PWA (SQLite-WASM/OPFS) vs Capacitor | riesgo de evicción de datos en Android, cámara/GPS, distribución rural, gama media |
| Sync engine | PowerSync / ElectricSQL / Zero / RxDB / WatermelonDB / Turso / outbox artesanal | fit Supabase+RLS, RN+SQLite, madurez producción, costo, mantenibilidad solo-founder |
| Analytics | Postgres schemas (como GANADATA) vs DuckDB/MotherDuck | escala real esperada, simplicidad |
| Evidencia (fotos) | Supabase Storage + cola diferida | sync de binarios separado del sync de datos |

## 6. Diseño visual — proceso (no estética todavía)

1. Decisión de marca: ¿continuidad GANADATA (verde #1B3B2F / gold #C8963E / cream) o
   identidad nueva? — **decisión de Gaspar, previa a todo**.
2. Dirección de arte: 3-4 direcciones visuales concretas (paleta/tipografía/tono) para
   elegir — informadas por referentes agro del research.
3. Design tokens + componentes base ANTES de la primera pantalla.
4. Restricciones duras: contraste AAA para sol directo, targets ≥ 48dp (uso con
   guantes), una decisión por pantalla, modo claro primero, tipografía grande.

## 7. Piezas que se extraen de GANADATA (ver docs/analisis_ganadata.md)

Scoring SQL (000058), DDL dim_requisito + seed idempotente, patrón RLS, audit_log,
infra mobile (client SQLite/auth/CI), patrón outbox, docs SENASA, caso Don Aquiles.

## 8. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Instrumento diverge del oficial (321 Excel vs 187 feedlot vs guía) | dim_instrumento_version + validación con la Comisión antes del seed final |
| Evicción de storage en Android (si PWA) | ⏳ research; si el riesgo es real → app nativa |
| Sync engine inmaduro/abandonado | preferir aburrido y probado; fallback outbox artesanal |
| Scope creep (trazabilidad, RFID, chat) | MVP = autodiagnóstico; el resto es roadmap |
| Fotos saturan sync rural | cola de binarios separada, compresión, sync solo-WiFi opcional |
```
