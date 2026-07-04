# CLAUDE.md — BPA Ganadero

## Proyecto

Plataforma de autodiagnóstico e implementación de BPA ganadero (producción bovina Argentina).

## Reglas

- Spec-first: definir arquitectura antes de codificar
- Stack se decide después del spec del MVP
- Documentación de decisiones en `/docs/`
- Investigación de mercado en `/research/`

## Dominio

**BPA** = Buenas Prácticas Agropecuarias (ganaderas)
- 321 requisitos en 14 categorías (Organización, Personal, Instalaciones, Suelo, Agua, Forrajes, Estiércol, Residuos, Cambio Climático, Manejo Rodeo, Alimentación, Salud Animal, Bienestar Animal, Establecimiento)
- Prioridades: NP1 (Esencial, 10pts) / NP2 (Importante, 5pts) / NP3 (Complementario, 2.5pts)
- Estados: IT (Implementado Total) / IP (Implementado Parcial) / NI (No Implementado) / NA (No Aplica)
- Scoring: porcentaje sobre máximo aplicable (excluye NA)

**Certificaciones formales en Argentina**: IRAM 14110, GlobalGAP, Aapresid

**Regulación clave**: Resolución 71/2024 — trazabilidad electrónica obligatoria bovinos, full compliance julio 2026

## Contexto de mercado

- No existe app de autodiagnóstico BPA para productores (solo para técnicos intermediarios via RENATBPA)
- Auditorías actuales: papel/Excel
- 78% pequeños productores sin conectividad → offline-first obligatorio
- 63.7% establecimientos son pequeños productores
- Gap explícito: trazabilidad obligatoria (Res 71/2024) ≠ BPA
