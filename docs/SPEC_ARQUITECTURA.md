# SPEC de Arquitectura — BPA Ganadero

**Versión:** 0.2 — 2026-07-05
**Estado:** dominio, modelo de datos y stack DECIDIDOS (research SOTA verificado).
Sin pendientes de stack: pricing PowerSync verificado GO (§5.2).

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

## 5. Decisiones de stack — ✅ DECIDIDAS (2026-07-05, deep research verificado 3-0 salvo nota)

### 5.1 Plataforma cliente: **Expo / React Native con EAS dev builds** (PWA descartada)

La PWA quedó **descartada por evidencia verificada**, no por preferencia:
- El storage del navegador (IndexedDB/OPFS) es "best-effort" por defecto y **puede ser
  desalojado bajo presión de disco** [3-0].
- `navigator.storage.persist()` en Chrome/Android **no pregunta al usuario: auto-aprueba
  o auto-deniega por heurísticas** (engagement, instalación) [3-0] — la persistencia no
  es garantizable justo en nuestro peor caso: teléfono de gama media con poco disco y
  semanas de evaluaciones sin sincronizar. Violación directa del axioma #3.
- expo-sqlite es production-supported en Android/iOS [3-0]; su soporte web es alpha [2-0].

Costo aceptado: build nativo vía EAS (los adapters SQLite nativos no corren en Expo Go
[3-0] — se desarrolla con dev client, que es el camino profesional igual). Distribución:
APK directo + Play Store.

### 5.2 Sync engine: **PowerSync** (con outbox de agregados propio encima)

Todo verificado 3-0 contra docs oficiales:
- SQLite local embebido como store de lectura/escritura inmediata, **fuente de verdad
  local** — exactamente el axioma #1.
- Cola de subida (upload queue) automática con conectividad intermitente; los writes
  llegan a Postgres **vía supabase-js, con RLS como capa de seguridad autoritativa**
  (no bypassea nuestro patrón RLS heredado de GANADATA).
- **Sync Streams**: sync parcial por usuario/tenant (YAML tipo SQL) — cada productor
  baja solo sus establecimientos.
- Integración Supabase oficial y documentada; SDK React Native oficial.
- El `uploadData()` es nuestro: ahí implementamos la subida de la **Evaluación como
  documento-agregado** (transacción completa), no fila suelta.

Descartes fundamentados:
- **ElectricSQL**: motor de *read-path* solamente; el write-path habría que armarlo a
  mano [3-0]. Componible, no solución completa.
- **RxDB**: viable (plugin Supabase oficial, checkpoints resumibles aptos para semanas
  offline [3-0]) pero **impone convenciones de schema en Postgres** (PK text,
  `_modified`, soft-deletes booleanos) que contaminan el lado Kimball o exigen un
  schema espejo [3-0]. Segunda opción si PowerSync falla.
- **Zero (Rocicorp)**: arquitectura web-first (⚠️ no verificado — murió en el corte del
  research; descartado además por perfil).
- Contexto que justifica elegir lo más productivo-probado: **la propia doc de Expo
  (mid-2026) advierte que el tooling local-first es inmaduro** y que el desarrollador
  deberá resolver problemas que las herramientas aún no resuelven [3-0].

✅ **Pricing/licencia verificados (2026-07-05, fuentes primarias)** — GO definitivo:
- **Cloud Free**: 2 GB sync/mes, 500 MB hosted, 50 conexiones concurrentes — sobra para
  dev y piloto. ⚠️ Letra chica: las instancias free se **desactivan tras 1 semana de
  inactividad** — para el piloto, mantener un heartbeat o pasar a Pro.
- **Cloud Pro**: USD 49/mes (30 GB sync/mes, 10 GB hosted, 1.000 conexiones) — viable
  para lanzamiento. Nuestro volumen de sync es trivial: las evaluaciones son texto
  (~cientos de KB por evaluación) y **las fotos NO pasan por PowerSync** (van directo a
  Storage por la cola de binarios, §5.4), así que los GB no escalan con la evidencia.
- **Self-hosted (salida de emergencia)**: `powersync-service` es **FSL-1.1-ALv2**
  (Functional Source License): uso productivo propio gratis e ilimitado — solo prohíbe
  competirle con un servicio de sync; cada versión se convierte a **Apache 2.0 a los
  2 años**. Docker, sin dashboard. SDK React Native: **Apache 2.0** pleno. Desarrollo
  activo (release v1.23.2 el 2026-07-02).
- **Plan B documentado** (si PowerSync desapareciera): outbox artesanal + upsert
  idempotente — la arquitectura de dominio (UUIDs cliente, documento-agregado) es
  idéntica con o sin PowerSync, el switch no toca el modelo.

### 5.3 Analytics: **Postgres/Supabase con schemas Kimball** (convención GANADATA)

A la escala realista del producto (10.000 evaluaciones ≈ 3,2M filas en fact_respuesta)
Postgres dimensional sobra. pg_duckdb/MotherDuck quedan anotados como camino de
escalado futuro (⚠️ claims no verificados — el research se cortó ahí) para cuando la
Red quiera analytics agregado nacional.

### 5.4 Evidencia (fotos): **Supabase Storage + cola de binarios separada**

Cola diferida independiente del sync de datos (compresión client-side, opción
solo-WiFi). Una evaluación puede cerrar y sincronizar con evidencias aún pendientes
de subida (estado visible por evidencia).

## 6. Marca y diseño visual

**DECIDIDO (2026-07-04): identidad NUEVA.** No es continuidad de GANADATA (aquello fue
el piloto de un productor particular). Esta es una app para cualquier productor y el
**comienzo de una marca paraguas para futuros desarrollos** — la identidad debe ser más
amplia que "el checklist BPG": una marca de productos digitales para el agro que pueda
albergar autodiagnóstico, capacitación, indicadores y lo que venga.

Implicancias:
- **Naming primero**: nombre propio, registrable (dominio .com/.ar disponible, sin
  conflicto de marca en INPI clase software/agro), pronunciable en el campo, que no
  encierre el producto en "BPA/BPG" (el instrumento es de la Red; la marca es nuestra).
  "bpa-ganadero" es nombre de repo, no de marca.
- Los tokens de GANADATA (verde/gold/cream) NO se heredan — referencia de lo que ya
  se exploró, nada más.

Proceso:
1. Naming (shortlist + verificación de disponibilidad) → decide Gaspar.
2. Dirección de arte: 3-4 direcciones visuales concretas (paleta/tipografía/tono/voz)
   para elegir — informadas por referentes agro del research SOTA.
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
| Evicción de storage en Android (si PWA) | ✅ RESUELTO: riesgo confirmado 3-0 → app nativa (§5.1) |
| Sync engine inmaduro/abandonado | preferir aburrido y probado; fallback outbox artesanal |
| Scope creep (trazabilidad, RFID, chat) | MVP = autodiagnóstico; el resto es roadmap |
| Fotos saturan sync rural | cola de binarios separada, compresión, sync solo-WiFi opcional |
```
