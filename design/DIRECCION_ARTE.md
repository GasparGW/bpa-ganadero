# Dirección de Arte — BPA Ganadero (nombre de trabajo)

**Fecha:** 2026-07-05 · **Estado:** dirección elegida y bajada a tokens.
**Mandato:** identidad nueva (marca paraguas futura), cero estética genérica de LLM,
profesional, diseñada para el campo (pleno sol, guantes, gama media, apuro).

---

## 1. Tres direcciones exploradas

### A — "Instrumento de campo" ✅ ELEGIDA
La app como instrumento de medición profesional: la estética del **documento técnico
bien impreso** — papel, tinta, reglas finas, datos tabulares — llevada a pantalla.
Superficies planas color hueso, texto tinta casi-negro, jerarquía por tipografía y
espacio (no por sombras ni gradientes), color reservado **exclusivamente para
semántica de estados** (IT/IP/NI/NA y sync). Grilla dura, códigos de requisito en
monospace como en una norma IRAM.

**Por qué es la más profesional:** transmite exactamente lo que el producto es — un
instrumento oficial auditable, no un juguete SaaS. El color-solo-semántico maximiza
legibilidad al sol (fondos claros, contraste máximo) y hace que el estado de cada
requisito sea la información más visible de la pantalla, que es la verdad funcional
del producto. Envejece bien, imprime bien (los reportes PDF heredan la identidad
gratis), y es inconfundible: nadie confunde esto con un template.

### B — "Estancia contemporánea" ❌
Cálida editorial: cremas, verdes profundos, serif display, fotografía. Linda para
marketing, pero es la dirección que un LLM elige solo (cream + serif + terracota es
literalmente el default documentado de los modelos 2026) y prioriza atmósfera sobre
función. Descartada por mandato anti-genérico y por legibilidad (serifs y cremas
bajan contraste al sol).

### C — "Maquinaria / industrial" ❌
Dark UI, amarillo seguridad, estética Cat/John Deere. Identidad fuerte pero **dark
mode es objetivamente peor a pleno sol** (reflejos en pantalla oscura) — falla la
restricción física #1 del contexto de uso. Descartada.

---

## 2. La dirección elegida, en concreto

### Principios
1. **Papel y tinta**: superficies `#FBFAF7` (hueso), texto `#191C1A` (tinta). Nada de
   gris medio para texto. Sin sombras, sin gradientes, sin glassmorphism. Bordes de
   1px `#D8D5CC` y reglas finas separan; el espacio jerarquiza.
2. **El color es información**: verde/ámbar/rojo/piedra pertenecen a IT/IP/NI/NA y al
   estado de sync. Ningún color decorativo compite con ellos. Redundancia
   color+letra+forma (daltonismo y sol): los botones de estado llevan siempre la
   sigla tipográfica grande.
3. **Tipografía con origen**: **Archivo** (Omnibus-Type, fundidora argentina, SIL OFL)
   como única familia UI — grotesca seria con carácter, variable (Expanded para
   display/números de score, regular para UI). **IBM Plex Mono** para códigos de
   requisito (`SAN-042`), hashes, RENSPA y todo dato de registro. La elección de una
   fundidora argentina no es cosmética: es coherencia de marca con el territorio.
4. **Denso pero enorme donde importa**: la información de contexto puede ser compacta;
   los puntos de decisión son gigantes. Botones de estado ≥ 56dp de alto, thumb-zone
   (mitad inferior de la pantalla), una decisión por pantalla.
5. **Voz**: castellano rioplatense, directo, técnico sin burocracia. "Guardado en el
   teléfono. Se sincroniza cuando haya señal." Nunca diminutivos, nunca emojis,
   nunca "¡Ups!".

### Paleta (contrastes verificados sobre fondo hueso `#FBFAF7`)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `ink` | `#191C1A` | texto principal | 16.4:1 AAA |
| `ink-2` | `#4A4F4A` | texto secundario | 7.6:1 AAA |
| `paper` | `#FBFAF7` | fondo | — |
| `surface` | `#FFFFFF` | tarjetas/campos | — |
| `line` | `#D8D5CC` | bordes, reglas | decorativo |
| `estado-it` | `#1B5E20` | IT (verde) — texto/fill sel. c/ blanco | 8.6:1 AAA |
| `estado-ip` | `#8A4B00` | IP (ámbar oscuro) — ídem | 7.0:1 AAA |
| `estado-ni` | `#A61B1B` | NI (rojo profundo) — ídem | 7.3:1 AAA |
| `estado-na` | `#57534E` | NA (piedra) — ídem | 6.9:1 AAA |
| `sync-pend` | `#8A4B00` | pendiente de sync (comparte ámbar) | — |
| `accent` | `#173F2C` | marca: verde monte profundo (headers, navegación activa) | 11.9:1 |

Nota: el blanco sobre cada color de estado ≥ 4.9:1 (AA para texto grande/bold, que es
como siempre se usa: siglas 18px+ bold).

### Tipografía
- **Archivo Expanded Bold** — display: scores, título de categoría, números grandes.
- **Archivo (variable) 400/600** — UI: cuerpo 17px mínimo (campo > desktop), labels 15px.
- **IBM Plex Mono 500** — códigos, datos de registro, timestamps.
- Números tabulares siempre (`font-variant-numeric: tabular-nums`) — los scores se
  comparan verticalmente.

### Layout y componentes clave
- Grilla de 4pt. Radios 4px (casi rectos: instrumento, no burbuja). Sin elevación.
- **Selector de estado** (el componente central del producto): 4 bloques
  IT / IP / NI / NA en fila, 56dp alto, sigla grande + color; seleccionado = fill
  pleno con sigla blanca; no seleccionado = borde 2px + sigla en color sobre blanco.
- **Barra de progreso de categoría**: regla fina con fracción `128/320` en Plex Mono.
- **Chip de sync**: siempre visible, honesto: `● 14 sin sincronizar` (ámbar) /
  `✓ Todo sincronizado` (verde). Nunca se oculta el estado de los datos (axioma #3).
- Iconografía: Lucide con stroke 2.25px (más grueso que el default: sol).

## 3. Verificación de la dirección
- `design/tokens.json` — tokens canónicos (fuente de verdad para RN/Tailwind).
- `design/mockup_evaluacion.html` — la pantalla de evaluación renderizada con estos
  tokens, abrible en el navegador. El mockup ES el contrato visual del MVP.
