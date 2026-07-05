-- 20260705120002 · Catálogo canónico del instrumento BPG-VC.
--
-- Es la referencia compartida (no tenant): versiones del instrumento oficial de la
-- Red BPA, sus categorías y sus requisitos. Diseñado SCD Type 2 desde el día 1
-- (vigente_desde / vigente_hasta): cuando la Comisión publique una versión nueva,
-- se inserta otra fila sin tocar las evaluaciones históricas, que quedan ancladas
-- a la versión con que se hicieron. content_sha256 sella el contenido exacto.

create table bpg.instrumento_version (
  id                 uuid primary key default gen_random_uuid(),
  instrumento        text        not null,              -- 'BPG-VC'
  version            text        not null,              -- '2026.07'
  nombre             text        not null,
  fuente             text,
  content_sha256     text        not null,
  total_requisitos   integer     not null,
  vigente_desde      date        not null default current_date,
  vigente_hasta      date,                              -- null = versión vigente (SCD2)
  creado_en          timestamptz not null default now(),
  unique (instrumento, version)
);

create unique index instrumento_version_una_vigente
  on bpg.instrumento_version (instrumento)
  where vigente_hasta is null;

create table bpg.categoria (
  instrumento_version_id uuid   not null references bpg.instrumento_version(id) on delete cascade,
  codigo                 text   not null,               -- 'SAN'
  nombre                 text   not null,
  orden                  integer not null,
  n_requisitos           integer not null,
  primary key (instrumento_version_id, codigo)
);

create table bpg.requisito (
  id                     uuid    primary key default gen_random_uuid(),
  instrumento_version_id uuid    not null references bpg.instrumento_version(id) on delete cascade,
  codigo                 text    not null,              -- 'SAN-042' (clave natural estable)
  categoria_codigo       text    not null,
  categoria              text    not null,
  seccion                text    not null,
  orden_global           integer not null,
  orden_categoria        integer not null,
  texto                  text    not null,
  np                     smallint not null check (np in (1, 2, 3)),
  peso                   numeric(4,1) not null check (peso in (10, 5, 2.5)),
  foreign key (instrumento_version_id, categoria_codigo)
    references bpg.categoria (instrumento_version_id, codigo),
  unique (instrumento_version_id, codigo)
);

create index requisito_por_categoria
  on bpg.requisito (instrumento_version_id, categoria_codigo, orden_categoria);

-- El peso debe ser coherente con el NP (contrato del instrumento).
alter table bpg.requisito add constraint peso_coherente_con_np
  check ((np = 1 and peso = 10) or (np = 2 and peso = 5) or (np = 3 and peso = 2.5));

-- Catálogo legible por cualquier usuario autenticado; nunca escribible desde el cliente.
alter table bpg.instrumento_version enable row level security;
alter table bpg.categoria           enable row level security;
alter table bpg.requisito           enable row level security;

create policy catalogo_lectura_version   on bpg.instrumento_version for select using (true);
create policy catalogo_lectura_categoria on bpg.categoria           for select using (true);
create policy catalogo_lectura_requisito on bpg.requisito           for select using (true);
