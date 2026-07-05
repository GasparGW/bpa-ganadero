-- 20260705120003 · OLTP operacional: establecimientos, personas, evaluaciones.
--
-- Esto es lo que vive en el SQLite del teléfono (fuente de verdad local) y
-- sincroniza PowerSync respetando RLS. Todos los ids son UUID generables en el
-- cliente offline (nunca SERIAL como clave de negocio). Una evaluación es un
-- documento-agregado: al cerrarla queda inmutable y con el score congelado.

-- ---------------------------------------------------------------- establecimiento
create table app.establecimiento (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  nombre          text not null,
  renspa          text,                       -- 01.234.5.67890/01
  localidad       text,
  provincia       text,
  superficie_ha   numeric(10,2),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------- persona
create table app.persona (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  nombre          text not null,
  rol             text,                       -- productor, responsable, veterinario…
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ------------------------------------------------------------------- evaluacion
create table app.evaluacion (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  establecimiento_id     uuid not null references app.establecimiento(id),
  instrumento_version_id uuid not null references bpg.instrumento_version(id),
  estado                 text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  abierta_en             timestamptz not null default now(),
  cerrada_en             timestamptz,
  -- Score congelado al cerrar (se recalcula y se persiste; no se deriva en lectura).
  puntos_obtenidos       numeric(8,2),
  maximo_aplicable       numeric(8,2),
  score_pct              numeric(5,2),
  creado_por             uuid references app.persona(id),
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  -- Una evaluación cerrada debe tener fecha de cierre y score; una abierta no.
  constraint cierre_coherente check (
    (estado = 'cerrada' and cerrada_en is not null and score_pct is not null)
    or (estado = 'abierta' and cerrada_en is null)
  )
);

create index evaluacion_por_establecimiento on app.evaluacion (establecimiento_id, abierta_en desc);

-- --------------------------------------------------------------------- respuesta
create table app.respuesta (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  evaluacion_id   uuid not null references app.evaluacion(id) on delete cascade,
  requisito_codigo text not null,             -- clave natural contra bpg.requisito de la versión
  estado          text not null check (estado in ('IT', 'IP', 'NI', 'NA')),
  observacion     text,
  actualizado_en  timestamptz not null default now(),
  unique (evaluacion_id, requisito_codigo)
);

-- ---------------------------------------------------------------------- evidencia
-- Las fotos NO pasan por PowerSync: van por cola binaria a Supabase Storage.
-- Acá vive sólo la referencia (path + metadatos + GPS).
create table app.evidencia (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  respuesta_id    uuid not null references app.respuesta(id) on delete cascade,
  tipo            text not null default 'foto' check (tipo in ('foto', 'observacion')),
  storage_path    text,
  gps_lat         numeric(9,6),
  gps_lng         numeric(9,6),
  tomada_en       timestamptz,
  creado_en       timestamptz not null default now()
);

-- --------------------------------------------------------------- updated_at triggers
create trigger t_establecimiento_upd before update on app.establecimiento
  for each row execute function app.tocar_actualizado_en();
create trigger t_persona_upd before update on app.persona
  for each row execute function app.tocar_actualizado_en();
create trigger t_evaluacion_upd before update on app.evaluacion
  for each row execute function app.tocar_actualizado_en();
create trigger t_respuesta_upd before update on app.respuesta
  for each row execute function app.tocar_actualizado_en();

-- ------------------------------------------------------------------------- RLS
-- Aislamiento por tenant: cada fila sólo es visible/mutable por su cuenta.
-- Autoridad única de seguridad multi-tenant (el cliente nunca elige tenant_id ajeno).
do $$
declare t text;
begin
  foreach t in array array['establecimiento', 'persona', 'evaluacion', 'respuesta', 'evidencia']
  loop
    execute format('alter table app.%I enable row level security', t);
    execute format($p$
      create policy tenant_aislado on app.%1$I
      using (tenant_id = app.current_tenant())
      with check (tenant_id = app.current_tenant())
    $p$, t);
  end loop;
end $$;
