# Curación del checklist — registro de cambios

**Fecha:** 2026-07-04
**Alcance:** se trabaja con las 14 categorías existentes (decisión del 2026-07-04).
Las guías Feedlot y Transporte NO se integran como categorías nuevas por ahora — sus
requisitos extraídos quedan en `data/` como materia prima.

## Problema

El checklist original (`app.html`, exportado de un Excel) tenía 11 requisitos rotos:
ítems que en el Excel eran encabezados de listas anidadas y quedaron truncados
terminando en ":", más un ítem partido en dos filas. Un requisito truncado no es
evaluable en una auditoría.

## Correcciones aplicadas (321 → 320 requisitos)

Fuente principal: **Guía BPG en Feedlot V2022 (Red BPA)** — usa la misma estructura de
capítulos que el checklist general, por lo que sus ítems numerados contienen el texto
completo de los requisitos truncados.

| # | Requisito truncado | Completado con | Fuente |
|---|---|---|---|
| 1 | "La planificación de los procesos claves incluye los siguientes aspectos:" | aspectos productivos, económicos, patrimoniales, financieros, ambientales, sociales, organizacionales, legales e impositivos | Feedlot ítem 1.1, p.7 |
| 2 | "El plan de capacitación integral..." + "y responsabilidades asignadas está documentado e incluye formación en:" (**ítem partido en 2 filas — FUSIONADO, por eso 321→320**) | formación en seguridad e higiene laboral, protección del ambiente y bienestar animal | Feedlot ítem 2.21, p.12 |
| 3 | "En el mapa /croquis se detalla:" | apotreramiento, instalaciones, accesos, fuentes hídricas, ambientes, suelos y demás características pertinentes | Feedlot ítem 3.12, p.13 |
| 4 | "Tiene un plan de higiene (limpieza) y mantenimiento de:" | las instalaciones, los equipos y las herramientas | Feedlot ítem 4.8, p.16 |
| 5 | "Los alambrados, cercos y tranqueras:" | construidos con materiales sin riesgo, sin salientes (púas, astillas, bisagras, bulones, clavos, tuercas), bordes redondeados | Feedlot ítem 4.13, p.19 |
| 6 | "Los alambrados eléctricos:" | diseñados/instalados/mantenidos para impacto adecuado (aprendizaje por reflejo condicionado) + verificación periódica | Feedlot ítems 4.15-4.16, p.19 |
| 7 | "El piso del corral:" | antideslizante, poco agresivo para pezuñas, sin pendiente o levemente positiva, sin salientes/pozos/charcos/piedras | Feedlot ítem 4.24, p.20 |
| 8 | "Para conocer las características del suelo se basa en:" | imágenes satelitales, datos de muestreos previos, cartas de suelos, mapa topográfico e historia de manejo | ✅ **VALIDADO** — Guía General BPG-VC ítem 5.1 (2026-07-04, texto oficial reemplazó la inferencia inicial) |
| 9 | "Respecto al riesgo de degradación del suelo se evalúan propiedades:" | propiedades físicas, químicas y biológicas | ✅ **VALIDADO** — Guía General BPG-VC ítem 5.2 (la inferencia coincidió textualmente) |
| 10 | "Respecto a la calidad del agua se analizan los parámetros:" | parámetros microbiológicos, químicos y físicos | Feedlot ítem 6.7, p.24 |
| 11 | "Respecto al estiércol y efluentes se considera:" | recolección, almacenamiento, acondicionamiento, tratamiento y posible uso, considerando clima y volúmenes estacionales | Feedlot ítems 7.4/7.2/7.7, p.25 |

Los NP originales de cada ítem se conservaron sin cambios.

## Pendiente

- ~~Validar los 2 ítems inferidos contra la Guía General~~ **RESUELTO 2026-07-04**: la
  Guía General BPG-VC apareció en el archive del proyecto rag-bpg (ahora en
  `docs/guia_general_bpg_vc.txt` + PDF); ambos ítems validados/corregidos con texto
  oficial (5.1 y 5.2). Ya no hay completions inferidas — las 11 tienen fuente oficial.
- Los datasets `data/requisitos_feedlot_v2022.json` (82 ítems) y
  `data/requisitos_transporte_comercializacion.json` (78 ítems) quedan extraídos con
  NP *propuesto* para cuando se decida sumar esas categorías.
