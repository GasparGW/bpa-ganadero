# Sprint 2 — Plan de acción guiado (+ demo web local en fase aparte)

**Estado:** SPEC revisado tras ciclo adversarial (4 revisores Opus + segunda pasada de
verificación contra código/guía/fórmula). Las 4 resoluciones originales se corrigieron;
abajo el detalle y, al final, el registro de qué cambió y por qué.

## Objetivo

Cerrar el eslabón del medio de la cadena de valor: del **resultado** (gaps priorizados)
al **plan** — para cada requisito No Implementado, *cómo resolverlo*, con contenido fiel a
la guía oficial de la Red BPA y 100% offline. El plan es el valor; se construye y se prueba
sobre el target **nativo que ya existe**.

El demo web-por-QR (mostrar el flujo en la sala) es una **fase posterior**, no el corazón
del sprint: el cuello de botella real es el contenido de guía, no la vía de entrega.

## Espinazo (revisado)

El adversarial volteó dos de las tres patas del espinazo original. El corregido:

1. **Procedencia etiquetada.** Cada afirmación del plan declara su fuente: `guia`
   (rastreable a un ítem verificado de la guía) o `editorial` (criterio nuestro, declarado
   como tal). El claim honesto NO es "todo trazable a la guía" — es "nada de la guía se
   inventa, y lo nuestro se declara como nuestro".
2. **Priorización por NP.** Es la única doctrina de orden real (la guía deja el orden a
   criterio del productor; ver `guia_general_bpg_vc.txt:74,99`). NP ya es lo que prioriza
   `gaps.ts`. El "impacto" al score ≡ NP exactamente (el denominador se cancela:
   `ΔScore_i/ΔScore_j = peso_i/peso_j`), así que no hay eje de impacto continuo que inventar.
3. **Orden total determinístico y testeado.** Clave de orden completa `NP → esfuerzo →
   orden_global`, sin empates sin resolver, con golden de empate como en `gaps.test.ts:48`.

## Decisiones de arquitectura

1. **El LLM vive en build-time (autoría), no en runtime.** El "cómo implementar" se redacta
   una vez, con IA + RAG sobre la guía, se revisa a mano, y se empaqueta versionado (como el
   instrumento, con `content_sha256` y drift-guard en CI). En el campo el runtime es
   **determinístico y offline**: no llama a ningún modelo, no inventa nada. (Confirmado
   correcto por el adversarial — es la parte con sustancia real.)
2. **El demo es el target web de Expo, 100% local, sin backend.** QR → la app corre en el
   teléfono del asistente → express local → score + recomendaciones. **Nada sale del
   dispositivo**: sin Supabase, sin tablero en vivo, sin PII, sin RENSPA a ningún servidor.
   Esto elimina de raíz el riesgo legal (Ley 25.326) y el "tablero n=8 se ve a juguete".

## Workstream 1 — Contenido de guía (build-time, RAG + revisión humana)

- **Fuente de verdad:** `docs/guia_general_bpg_vc.txt` (Guía BPG-VC, Red BPA 2019).
- **Crosswalk MANUAL, no automático.** El instrumento re-atomizó la guía: 320 requisitos vs
  ~254 ítems numerados `N.M`, y 13/14 categorías divergen (ej. SAN tiene 68 requisitos pero
  la guía llega a 13.36 → ~32 sin ítem por número). **`orden_categoria` NO es el número de
  ítem de la guía.** El mapeo requisito→`cita_item` se cura a mano, requisito por requisito,
  con un test que valide que el ítem citado existe en la guía.
- **Procedencia por campo:**
  - `como_implementar`: pasos accionables. **Grounding por afirmación** — cada paso rastrea
    a un pasaje de la guía, o se marca como recomendación operativa (no textual). La guía es
    de alto nivel; redactar pasos sin este control interpola prácticas plausibles no textuales.
  - `evidencia_sugerida`: qué registro/foto sirve de prueba.
  - `cita`: sección + ítem verificado (`fuente: guia`).
  - `nivel_esfuerzo`: **estimación EDITORIAL nuestra, no doctrina RedBPA** (la palabra
    "esfuerzo" no aparece en la guía: 0 ocurrencias). Se etiqueta como tal.
- **Estados de cobertura:** `curada` (pasos + evidencia + cita, revisada a mano) o `derivada`
  (sólo contexto de categoría + cita a nivel categoría, **sin pasos inventados**, con
  disclaimer honesto en UI: "contexto general, no guía específica de este ítem"). El
  manifiesto de cobertura cuenta curadas y derivadas **por separado** — una derivada no
  cuenta como "cobertura con procedencia específica".
- **Guardas de CI (distintas del sha):**
  - **Integridad referencial bidireccional** (falla dura): toda `cita` apunta a un código que
    existe en el instrumento; se reportan los requisitos sin guía (permitido sólo si declarado).
    El `content_sha256` NO detecta guía huérfana ni cobertura faltante — hace falta este guard.
  - **Contrato de compatibilidad:** la guía declara `compat_instrumento: "2026.07"`; el loader
    falla ruidoso si no matchea la versión del instrumento bundleado (el instrumento está en
    "borrador — pendiente validación", el conteo ya se movió 321→320: la guía versionada aparte
    va a apuntar a códigos viejos cuando la Comisión valide).
- **Empaquetado:** `data/guia/bpg-vc_2026.07_guia.json` → módulo TS (`gen_guia_ts.mjs`), con
  `content_sha256` y drift-guard, igual que el instrumento.
- **Alcance de autoría v1:** **NP1 de 1–2 categorías, curadas.** El resto queda `derivada`
  desde el día uno (nunca vacío). Se declara explícito lo que falta.

## Workstream 2 — Motor del plan (dominio puro, determinístico)

- `domain/guia.ts`: tipos de la guía (`GuiaRequisito`, `NivelEsfuerzo`, procedencia) + rango
  de esfuerzo para el orden.
- `domain/plan.ts`: `construirPlan(respuestas, requisitosPorCodigo, guiaPorCodigo) → Plan`.
  Enriquece el análisis de gaps (que ya existe) con la guía, ordenado y agrupado:
  - **Filtra** a los NI (lo NA no aparece), vía `analizarGaps`.
  - **Orden total** `NP → esfuerzo → orden_global`. Esfuerzo: bajo < medio < alto <
    desconocido (los sin estimar no saltan a "ganancia rápida"). Clave completa: sin empates.
  - **Cuantifica** reusando `gaps.ts`: `score_actual`, `score_potencial`, `np1_ni`.
  - **Agrupa** por categoría (orden por `orden_global` mínimo, como `categoriasDe`), con el
    score de cada una.
- **Diferido a v2 (fuera de scope, confirmado por el adversarial):** secuenciación por
  doctrina y prerrequisitos entre requisitos. La guía casi no enuncia prerrequisitos;
  inferirlos de las "(Ver …)" sería la heurística frágil que el espinazo dice evitar. Cuando
  entren, hay que definir precedencia sobre el orden base y desempate topológico determinístico.
- Puro, testeado con Vitest, sin LLM ni red. Mismo estándar que `scoring.ts`/`gaps.ts`.

## Workstream 3 — Pantalla del plan (offline, dirección "Instrumento de campo")

- Nueva `PlanScreen`, accesible desde Resultado ("Ver plan de acción").
- Lista accionable tipo checklist: cada gap con su `como_implementar` (o el disclaimer de
  derivada), evidencia sugerida, cita a la guía, esfuerzo (etiquetado editorial) e impacto en
  el score. Marcable "en progreso / hecho" (persistido local; sync real diferido, el chip no
  miente).
- Fiel a paper/tinta, color solo semántico, botones 64dp.

## Workstream 4 — Demo web local por QR (FASE APARTE, después del núcleo)

No es el corazón del sprint. Se hace cuando el núcleo nativo (WS1–WS3) esté entregado.

- **Prerrequisito técnico [P0]:** reemplazar `Alert.alert` con botones por un **modal RN
  propio** (código compartido). En react-native-web el `onPress` de los botones de `Alert` no
  dispara → hoy el cierre de evaluación (`EvaluacionScreen.tsx:93-120`) no funciona en web y
  bloquea llegar al resultado/plan. Verificado.
- **Target web:** `react-native-web` (falta instalar y configurar el target web de Expo;
  la infra web no existe aún — no es "el mismo código ya corre").
- **Driver web:** `SqlDriver` in-memory por sesión (simple, sin headers COOP/COEP). No hace
  falta persistencia: el demo es efímero por diseño. (OPFS/wa-sqlite queda para producción web
  futura, no para el demo.)
- **Experiencia:** QR → "probá como si fuera tu establecimiento" → express → score +
  recomendaciones, todo local. El framing de ensayo baja la exigencia y evita el problema de
  "no tengo mis registros a mano / no soy el dueño del dato".
- **Modo express (correcto matemáticamente):**
  - Subconjunto de NP1 **respondibles de memoria/observables** (no documentales tipo "¿tenés
    el plan sanitario firmado?").
  - **NO mostrar un %.** Con N ítems de puro NP1, cada click mueve `100/N` (6.67 pts con N=15,
    12.5 con N=8) → se ve inestable, y `score_potencial` degenera a 100% siempre. En su lugar:
    **"resolviste M de N esenciales"** + las recomendaciones. Honesto y estable.
  - Suprimir el mensaje "subiría a X%" en modo express (sólo tiene sentido con NP mezclados).
- **Robustez de sala:** app precacheada (PWA) para sobrevivir wifi malo — una vez cargada,
  corre offline; usar el **modo avión como demostración del diferencial**. **Video de respaldo**
  que cuente el 100% del mensaje sin que nadie toque su teléfono. Caso piloto (Don Aquiles /
  Agropemar) proyectado local en el dispositivo del presentador.

## Fases y camino crítico

El cuello de botella es el **contenido** (autoría + revisión humana), no el código.

**Este sprint (núcleo nativo):**
1. Motor `plan.ts` + `guia.ts` + tests (WS2) — puro, arranca ya contra guía inyectada.
2. Bundle de guía para NP1 de 1–2 categorías + guardas de CI (WS1).
3. `PlanScreen` (WS3).

**Fase siguiente (demo):** todo WS4 (Alert→modal, target web, driver web, express, PWA, QR).

## Verificación

- `plan.ts` con tests de dominio (Vitest), incluyendo **golden de empate del orden total**.
- Guía bundleada con drift-guard + integridad referencial bidireccional + contrato de compat.
- `tsc --noEmit` limpio. (Demo web: build web corre; QR abre el flujo en un teléfono real.)

## Registro del ciclo adversarial (qué cambió y por qué)

- **Anclaje de citas:** `orden_categoria → N.M` no existe (verificado: SAN 68 vs guía 13.36).
  → crosswalk manual `cita_item` + test de existencia.
- **`nivel_esfuerzo`:** 0 ocurrencias de "esfuerzo" en la guía → se etiqueta editorial, no doctrina.
- **"Organización primero":** la guía dice que el orden lo elige el productor (L74, L99) → se
  elimina la secuenciación por doctrina; orden por NP.
- **Impacto ≡ NP:** el denominador se cancela → la "matriz impacto×esfuerzo" es NP×esfuerzo.
- **Determinismo:** clave de orden total `NP → esfuerzo → orden_global` + golden de empate.
- **Score express:** salta 6.67–12.5 pts/click y el potencial degenera a 100% → checklist
  "M de N", sin %.
- **`content_sha256`:** no detecta huérfanos/cobertura → guard bidireccional + contrato de compat.
- **Fallback derivada:** era relleno de categoría → disclaimer honesto, sin pasos inventados,
  manifiesto que separa curadas de derivadas.
- **Alcance:** el Sprint 2 original eran ~3 sprints → núcleo nativo ahora, demo web fase aparte.
- **Privacidad/tablero:** RENSPA identificable + n=8 se ve a juguete → demo 100% local, sin
  backend, sin tablero.
- **Novedad:** determinismo es higiene base, no diferenciador → el pitch se centra en el plan
  de remediación grounded, offline, en manos del productor.
