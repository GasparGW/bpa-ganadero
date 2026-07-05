-- 20260705120004 · Scoring BPG-VC del lado servidor.
--
-- bpg.calcular_score es la implementación servidor de la fórmula oficial y debe
-- reproducir EXACTAMENTE data/golden_scoring.json (misma referencia que el cliente
-- TS y el Python de build_instrumento.py). Toma un jsonb {codigo: estado} — la
-- misma forma que los golden cases — y puntúa contra los requisitos de una versión.
--
--   score = Σ(peso × mult) / Σ(peso | estado ≠ NA) × 100
--   NP1=10 NP2=5 NP3=2.5 · IT=1 IP=0.5 NI=0 · NA excluido del denominador

create or replace function bpg.calcular_score(
  p_respuestas jsonb,
  p_instrumento_version_id uuid
)
returns table (puntos_obtenidos numeric, maximo_aplicable numeric, score_pct numeric)
language plpgsql
stable
as $$
declare
  v_estado_invalido text;
  v_codigo_desconocido text;
begin
  -- Fallar ruidoso ante estado inválido (paridad con el contrato del cliente).
  select re.estado into v_estado_invalido
  from jsonb_each_text(p_respuestas) as re(codigo, estado)
  where re.estado not in ('IT', 'IP', 'NI', 'NA')
  limit 1;
  if v_estado_invalido is not null then
    raise exception 'Estado de respuesta inválido: %', v_estado_invalido;
  end if;

  -- Fallar ruidoso ante código inexistente (los NA se ignoran antes del lookup,
  -- igual que en el cliente TS: estado === 'NA' -> continue).
  select re.codigo into v_codigo_desconocido
  from jsonb_each_text(p_respuestas) as re(codigo, estado)
  left join bpg.requisito r
    on r.instrumento_version_id = p_instrumento_version_id and r.codigo = re.codigo
  where r.id is null and re.estado <> 'NA'
  limit 1;
  if v_codigo_desconocido is not null then
    raise exception 'Respuesta sobre requisito desconocido: %', v_codigo_desconocido;
  end if;

  return query
  with aplicable as (
    select r.peso,
           case re.estado when 'IT' then 1.0 when 'IP' then 0.5 when 'NI' then 0.0 end as mult
    from jsonb_each_text(p_respuestas) as re(codigo, estado)
    join bpg.requisito r
      on r.instrumento_version_id = p_instrumento_version_id and r.codigo = re.codigo
    where re.estado <> 'NA'
  )
  select
    round(coalesce(sum(a.peso * a.mult), 0), 2)::numeric,
    round(coalesce(sum(a.peso), 0), 2)::numeric,
    case when coalesce(sum(a.peso), 0) = 0 then null
         else round(sum(a.peso * a.mult) / sum(a.peso) * 100, 2) end::numeric
  from aplicable a;
end $$;

-- Score de una evaluación concreta: arma el jsonb desde sus respuestas y puntúa.
create or replace function app.score_evaluacion(p_evaluacion_id uuid)
returns table (puntos_obtenidos numeric, maximo_aplicable numeric, score_pct numeric)
language sql
stable
as $$
  select s.*
  from bpg.calcular_score(
    (select coalesce(jsonb_object_agg(requisito_codigo, estado), '{}'::jsonb)
       from app.respuesta where evaluacion_id = p_evaluacion_id),
    (select instrumento_version_id from app.evaluacion where id = p_evaluacion_id)
  ) s;
$$;

-- Cierra una evaluación: congela el score y la vuelve inmutable.
create or replace function app.cerrar_evaluacion(p_evaluacion_id uuid)
returns app.evaluacion
language plpgsql
as $$
declare
  s record;
  ev app.evaluacion;
begin
  select * into s from app.score_evaluacion(p_evaluacion_id);
  update app.evaluacion
     set estado = 'cerrada',
         cerrada_en = now(),
         puntos_obtenidos = s.puntos_obtenidos,
         maximo_aplicable = s.maximo_aplicable,
         score_pct = s.score_pct
   where id = p_evaluacion_id and estado = 'abierta'
   returning * into ev;
  if ev.id is null then
    raise exception 'Evaluación % no existe o ya está cerrada', p_evaluacion_id;
  end if;
  return ev;
end $$;
