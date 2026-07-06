/**
 * Esquema del SQLite local — ESPEJO del OLTP del servidor (supabase/migrations
 * 20260705120003_oltp_evaluaciones.sql), en dialecto SQLite.
 *
 * El SQLite del teléfono es la FUENTE DE VERDAD local (axioma #1): la app opera
 * semanas sin señal. Todo id es UUID generado en el cliente (axioma #4), nunca
 * autoincremental como clave de negocio. `pendiente_sync = 1` marca filas que aún
 * no subieron: el chip de sync cuenta sobre eso (axioma #3, cero pérdida silenciosa).
 *
 * Subconjunto de Sprint 1: establecimiento + evaluacion + respuesta. Persona,
 * evidencia (fotos) y el transporte de sync llegan en sprints siguientes; el modelo
 * de dominio no cambia cuando se agreguen (mismo agregado, mismos UUIDs).
 */

export const ESQUEMA_VERSION = 1;

/** DDL idempotente. Se aplica en cada arranque; CREATE ... IF NOT EXISTS. */
export const ESQUEMA_SQL = `
pragma foreign_keys = on;

create table if not exists establecimiento (
  id             text primary key,
  tenant_id      text not null,
  nombre         text not null,
  renspa         text,
  localidad      text,
  provincia      text,
  creado_en      text not null,
  actualizado_en text not null,
  pendiente_sync integer not null default 1
);

create table if not exists evaluacion (
  id                 text primary key,
  tenant_id          text not null,
  establecimiento_id text not null references establecimiento(id),
  instrumento        text not null,
  version            text not null,
  -- Modo del recorrido: 'completo' (los 320) o 'express' (subset curado de esenciales,
  -- una prueba rápida). Vive en la fila para que el historial y el sync futuro puedan
  -- distinguir una prueba express de un autodiagnóstico real (no contaminar indicadores).
  modo               text not null default 'completo' check (modo in ('completo', 'express')),
  estado             text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  abierta_en         text not null,
  cerrada_en         text,
  puntos_obtenidos   real,
  maximo_aplicable   real,
  score_pct          real,
  actualizado_en     text not null,
  pendiente_sync     integer not null default 1,
  -- Espejo del CHECK cierre_coherente del servidor: cerrada ⇒ tiene fecha de
  -- cierre; abierta ⇒ no. score_pct puede ser NULL en una cerrada legítima (todo NA).
  check ((estado = 'cerrada' and cerrada_en is not null)
      or (estado = 'abierta' and cerrada_en is null))
);

create index if not exists evaluacion_por_establecimiento
  on evaluacion (establecimiento_id, abierta_en desc);

create table if not exists respuesta (
  id               text primary key,
  tenant_id        text not null,
  evaluacion_id    text not null references evaluacion(id) on delete cascade,
  requisito_codigo text not null,
  estado           text not null check (estado in ('IT', 'IP', 'NI', 'NA')),
  observacion      text,
  actualizado_en   text not null,
  pendiente_sync   integer not null default 1,
  unique (evaluacion_id, requisito_codigo)
);
`;
