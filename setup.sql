-- =====================================================================
-- setup.sql · Presupuesto Operativo Anual IASD · Supabase (PostgreSQL)
-- Ejecutar completo, una sola vez, en: Supabase > SQL Editor > New query
-- Al final hay un bloque COMENTADO para crear tu primera iglesia y superadmin.
-- Modelo: TODA escritura de presupuestos pasa por funciones RPC (security definer);
--         las tablas solo exponen SELECT filtrado por RLS (+ catálogo de departamentos).
-- =====================================================================

-- ---------- 1. TABLAS ----------
create table public.iglesias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  distrito text,
  asociacion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.usuarios_autorizados (            -- Allowlist (spec 2.1)
  id uuid primary key default gen_random_uuid(),
  email text not null unique,                          -- se guarda siempre en minúsculas (trigger)
  nombre text not null,
  rol text not null check (rol in ('superadmin','tesorero','secretario','director','junta')),
  iglesia_id uuid references public.iglesias(id) on delete set null,   -- iglesia por defecto (opcional)
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.usuario_iglesias (                 -- Multitenancy (spec 2.2): N iglesias por usuario
  usuario_id uuid not null references public.usuarios_autorizados(id) on delete cascade,
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  primary key (usuario_id, iglesia_id)
);

create table public.departamentos (                    -- Catálogo por iglesia (Fase 3)
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create unique index uq_departamento_nombre on public.departamentos (iglesia_id, lower(nombre));

create table public.presupuesto_encabezado (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  anio_evaluado int not null,                          -- N-1
  anio_presupuestado int not null,                     -- N
  porcentaje_inflacion numeric(5,2) not null default 5.00,
  porcentaje_crecimiento numeric(5,2) not null default 0,
  fase_actual int not null default 1 check (fase_actual between 1 and 5),
  estado text not null default 'borrador' check (estado in ('borrador','en_revision','aprobado')),
  resumen jsonb,                                       -- estadística, desafío de fe, proyección, saldos (al cerrar)
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (anio_presupuestado > anio_evaluado),
  unique (iglesia_id, anio_presupuestado)
);

create table public.presupuesto_datos (                -- Estado de trabajo del wizard (borrador completo)
  presupuesto_id uuid primary key references public.presupuesto_encabezado(id) on delete cascade,
  datos jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.historico_ejecucion (              -- Fase 2 materializada al enviar a revisión
  presupuesto_id uuid not null references public.presupuesto_encabezado(id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  diezmos numeric(14,2) default 0,
  remesa_20 numeric(14,2) default 0, remesa_16 numeric(14,2) default 0,
  remesa_4 numeric(14,2) default 0,  remesa_ofg numeric(14,2) default 0,
  ofrenda_100 numeric(14,2) default 0, ofrenda_local_60 numeric(14,2) default 0,
  ingresos_directos numeric(14,2) default 0, ofrenda_60_mes numeric(14,2) default 0,
  gastos numeric(14,2) default 0, saldo_mensual numeric(14,2) default 0,
  primary key (presupuesto_id, mes)
);

create table public.presupuesto_departamental (        -- Fases 3, 4 y 5 por departamento
  presupuesto_id uuid not null references public.presupuesto_encabezado(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete restrict,
  porcentaje_asignado numeric(9,4) default 0, ingresos numeric(14,2) default 0,
  gasto numeric(14,2) default 0, gastos_miscelaneos numeric(14,2) default 0,
  ingresos_directos numeric(14,2) default 0,
  transf_entrantes numeric(14,2) default 0, transf_salientes numeric(14,2) default 0,
  saldo_final numeric(14,2) default 0,
  gasto_estimado numeric(14,2) default 0, limite_indexado numeric(14,2) default 0,
  monto_aprobado numeric(14,2) default 0, comentario_ajuste text,
  porcentaje_concilio numeric(9,4) default 0, gasto_por_porcentaje numeric(14,2) default 0,
  saldo_corte numeric(14,2) default 0, ajustes numeric(14,2) default 0,
  porcentaje_junta numeric(9,4) default 0, saldo_aprobado_junta numeric(14,2) default 0,
  primary key (presupuesto_id, departamento_id)
);

create index on public.usuario_iglesias (iglesia_id);
create index on public.departamentos (iglesia_id);
create index on public.presupuesto_encabezado (iglesia_id, updated_at desc);

-- ---------- 2. TRIGGERS ----------
create function public.trg_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_touch_enc before update on public.presupuesto_encabezado for each row execute function public.trg_touch();
create trigger t_touch_dat before update on public.presupuesto_datos for each row execute function public.trg_touch();

create function public.trg_email_lower() returns trigger language plpgsql as $$
begin new.email := lower(trim(new.email)); return new; end $$;
create trigger t_email before insert or update on public.usuarios_autorizados for each row execute function public.trg_email_lower();

create function public.trg_sync_usuario_iglesia() returns trigger language plpgsql as $$
begin
  if new.iglesia_id is not null then
    insert into public.usuario_iglesias values (new.id, new.iglesia_id) on conflict do nothing;
  end if; return new;
end $$;
create trigger t_sync_ui after insert or update of iglesia_id on public.usuarios_autorizados for each row execute function public.trg_sync_usuario_iglesia();

create function public.trg_seed_departamentos() returns trigger language plpgsql as $$
begin
  insert into public.departamentos (iglesia_id, nombre, orden)
  select new.id, n, o from unnest(array['Ministerio de la Juventud','Ministerio Infantil y del Adolescente','Escuela Sabática',
    'Mayordomía Cristiana','Ministerio de la Mujer','Evangelismo y Misión Global','Servicios e Infraestructura']) with ordinality as t(n,o);
  return new;
end $$;
create trigger t_seed_deps after insert on public.iglesias for each row execute function public.trg_seed_departamentos();

-- ---------- 3. FUNCIONES AUXILIARES (usadas por RLS y RPC) ----------
create function public.fn_email() returns text language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;

create function public.fn_rol() returns text language sql stable security definer set search_path = public
as $$ select rol from usuarios_autorizados where email = fn_email() and activo limit 1 $$;

create function public.fn_tiene_iglesia(p uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios_autorizados u where u.email = fn_email() and u.activo
       and (u.rol = 'superadmin' or exists (select 1 from usuario_iglesias ui where ui.usuario_id = u.id and ui.iglesia_id = p))) $$;

create function public.fn_puede_editar(p uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios_autorizados u where u.email = fn_email() and u.activo
       and u.rol in ('superadmin','tesorero','secretario')
       and (u.rol = 'superadmin' or exists (select 1 from usuario_iglesias ui where ui.usuario_id = u.id and ui.iglesia_id = p))) $$;

create function public.fn_iglesia_de(p_pres uuid) returns uuid language sql stable security definer set search_path = public
as $$ select iglesia_id from presupuesto_encabezado where id = p_pres $$;

-- ---------- 4. RLS ----------
alter table public.iglesias                  enable row level security;
alter table public.usuarios_autorizados      enable row level security;
alter table public.usuario_iglesias          enable row level security;
alter table public.departamentos             enable row level security;
alter table public.presupuesto_encabezado    enable row level security;
alter table public.presupuesto_datos         enable row level security;
alter table public.historico_ejecucion       enable row level security;
alter table public.presupuesto_departamental enable row level security;

create policy iglesias_sel on public.iglesias for select to authenticated using (fn_tiene_iglesia(id));
create policy iglesias_adm on public.iglesias for all    to authenticated using (fn_rol() = 'superadmin') with check (fn_rol() = 'superadmin');

create policy usuarios_sel on public.usuarios_autorizados for select to authenticated using (email = fn_email() or fn_rol() = 'superadmin');
create policy usuarios_adm on public.usuarios_autorizados for all    to authenticated using (fn_rol() = 'superadmin') with check (fn_rol() = 'superadmin');

create policy ui_sel on public.usuario_iglesias for select to authenticated
  using (fn_rol() = 'superadmin' or usuario_id in (select id from usuarios_autorizados where email = fn_email()));
create policy ui_adm on public.usuario_iglesias for all to authenticated using (fn_rol() = 'superadmin') with check (fn_rol() = 'superadmin');

create policy dep_sel on public.departamentos for select to authenticated using (fn_tiene_iglesia(iglesia_id));
create policy dep_ins on public.departamentos for insert to authenticated with check (fn_puede_editar(iglesia_id));
create policy dep_upd on public.departamentos for update to authenticated using (fn_puede_editar(iglesia_id)) with check (fn_puede_editar(iglesia_id));

create policy enc_sel on public.presupuesto_encabezado for select to authenticated using (fn_tiene_iglesia(iglesia_id));
create policy enc_del on public.presupuesto_encabezado for delete to authenticated using (fn_rol() = 'superadmin');
create policy dat_sel on public.presupuesto_datos         for select to authenticated using (fn_tiene_iglesia(fn_iglesia_de(presupuesto_id)));
create policy his_sel on public.historico_ejecucion       for select to authenticated using (fn_tiene_iglesia(fn_iglesia_de(presupuesto_id)));
create policy pd_sel  on public.presupuesto_departamental for select to authenticated using (fn_tiene_iglesia(fn_iglesia_de(presupuesto_id)));
-- Sin políticas de INSERT/UPDATE en presupuestos: solo las RPC (security definer) pueden escribir.

-- ---------- 5. RPC (lógica de negocio del lado servidor) ----------
-- 5.1 Contexto del usuario: valida allowlist y devuelve sus iglesias (null si no está autorizado)
create function public.mi_contexto() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u usuarios_autorizados;
begin
  select * into u from usuarios_autorizados where email = fn_email() and activo;
  if not found then return null; end if;
  return jsonb_build_object(
    'usuario', jsonb_build_object('id', u.id, 'email', u.email, 'nombre', u.nombre, 'rol', u.rol),
    'iglesias', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre) order by i.nombre)
        from iglesias i where i.activa and (u.rol = 'superadmin'
          or exists (select 1 from usuario_iglesias ui where ui.usuario_id = u.id and ui.iglesia_id = i.id))), '[]'::jsonb));
end $$;

-- 5.2 Guardado (UPSERT) del borrador: encabezado + estado de trabajo, atómico
create function public.guardar_borrador(p_iglesia uuid, p_id uuid, p_anio_evaluado int, p_anio_pres int,
  p_fase int, p_infl numeric, p_crec numeric, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_estado text;
begin
  if not fn_puede_editar(p_iglesia) then
    raise exception 'No tienes permiso para editar presupuestos de esta iglesia.' using errcode = '42501';
  end if;
  if v_id is null then
    insert into presupuesto_encabezado (iglesia_id, anio_evaluado, anio_presupuestado, porcentaje_inflacion, porcentaje_crecimiento, fase_actual, creado_por)
    values (p_iglesia, p_anio_evaluado, p_anio_pres, coalesce(p_infl,5), coalesce(p_crec,0), greatest(1, least(5, coalesce(p_fase,1))), fn_email())
    returning id into v_id;
  else
    select estado into v_estado from presupuesto_encabezado where id = v_id and iglesia_id = p_iglesia for update;
    if not found then raise exception 'Presupuesto no encontrado.'; end if;
    if v_estado <> 'borrador' then raise exception 'El presupuesto está en estado "%" y no se puede editar.', v_estado; end if;
    update presupuesto_encabezado set porcentaje_inflacion = coalesce(p_infl,5), porcentaje_crecimiento = coalesce(p_crec,0),
      fase_actual = greatest(1, least(5, coalesce(p_fase,1))) where id = v_id;
  end if;
  insert into presupuesto_datos (presupuesto_id, datos) values (v_id, coalesce(p_datos,'{}'))
  on conflict (presupuesto_id) do update set datos = excluded.datos;
  return v_id;
end $$;

-- 5.3 Carga del presupuesto de una iglesia/año (respeta RLS: security invoker)
create function public.cargar_borrador(p_iglesia uuid, p_anio int) returns jsonb language sql stable as $$
  select jsonb_build_object('id', e.id, 'estado', e.estado, 'fase_actual', e.fase_actual,
    'anio_evaluado', e.anio_evaluado, 'anio_presupuestado', e.anio_presupuestado, 'datos', coalesce(d.datos, '{}'::jsonb))
  from presupuesto_encabezado e left join presupuesto_datos d on d.presupuesto_id = e.id
  where e.iglesia_id = p_iglesia and e.anio_presupuestado = p_anio $$;

-- 5.4 Máquina de estados + validaciones duras + materialización a tablas de reporte
create function public.cambiar_estado(p_id uuid, p_nuevo text, p_resumen jsonb default null,
  p_historico jsonb default null, p_departamentos jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare e presupuesto_encabezado; v_rol text; v_tp numeric; v_te numeric; v_ts numeric; v_tc numeric;
begin
  select * into e from presupuesto_encabezado where id = p_id for update;
  if not found then raise exception 'Presupuesto no encontrado.'; end if;
  if not fn_tiene_iglesia(e.iglesia_id) then raise exception 'Sin acceso a esta iglesia.' using errcode = '42501'; end if;
  v_rol := fn_rol();

  if e.estado = 'borrador' and p_nuevo = 'en_revision' then
    if v_rol not in ('superadmin','tesorero','secretario') then raise exception 'Tu rol no puede enviar a revisión.'; end if;
    if p_historico is null or jsonb_array_length(p_historico) = 0 then raise exception 'Falta la ejecución mensual (Fase 2).'; end if;
    if p_departamentos is null or jsonb_array_length(p_departamentos) = 0 then raise exception 'Faltan los departamentos (Fase 3).'; end if;
    if exists (select 1 from jsonb_to_recordset(p_departamentos) x(departamento_id uuid)
               left join departamentos d on d.id = x.departamento_id and d.iglesia_id = e.iglesia_id where d.id is null) then
      raise exception 'Hay departamentos que no pertenecen a esta iglesia.';
    end if;
    select sum(porcentaje_asignado), sum(transf_entrantes), sum(transf_salientes), sum(porcentaje_concilio)
      into v_tp, v_te, v_ts, v_tc
      from jsonb_to_recordset(p_departamentos) x(porcentaje_asignado numeric, transf_entrantes numeric, transf_salientes numeric, porcentaje_concilio numeric);
    if abs(coalesce(v_tp,0) - 100) > 0.05 then raise exception 'La suma de %% asignado es %, debe ser 100.', round(coalesce(v_tp,0),2); end if;
    if abs(coalesce(v_te,0) - coalesce(v_ts,0)) > 0.01 then raise exception 'Las transferencias entrantes (%) no igualan a las salientes (%).', v_te, v_ts; end if;
    if abs(coalesce(v_tc,0) - 100) > 0.05 then raise exception 'La suma de Propuesta %% Concilio es %, debe ser 100.', round(coalesce(v_tc,0),2); end if;

    delete from historico_ejecucion where presupuesto_id = p_id;
    insert into historico_ejecucion (presupuesto_id, mes, diezmos, remesa_20, remesa_16, remesa_4, remesa_ofg, ofrenda_100,
        ofrenda_local_60, ingresos_directos, ofrenda_60_mes, gastos, saldo_mensual)
    select p_id, mes, diezmos, remesa_20, remesa_16, remesa_4, remesa_ofg, ofrenda_100, ofrenda_local_60, ingresos_directos, ofrenda_60_mes, gastos, saldo_mensual
    from jsonb_to_recordset(p_historico) x(mes int, diezmos numeric, remesa_20 numeric, remesa_16 numeric, remesa_4 numeric, remesa_ofg numeric,
        ofrenda_100 numeric, ofrenda_local_60 numeric, ingresos_directos numeric, ofrenda_60_mes numeric, gastos numeric, saldo_mensual numeric);

    delete from presupuesto_departamental where presupuesto_id = p_id;
    insert into presupuesto_departamental (presupuesto_id, departamento_id, porcentaje_asignado, ingresos, gasto, gastos_miscelaneos, ingresos_directos,
        transf_entrantes, transf_salientes, saldo_final, gasto_estimado, limite_indexado, monto_aprobado, comentario_ajuste, porcentaje_concilio,
        gasto_por_porcentaje, saldo_corte, ajustes, porcentaje_junta, saldo_aprobado_junta)
    select p_id, departamento_id, porcentaje_asignado, ingresos, gasto, gastos_miscelaneos, ingresos_directos, transf_entrantes, transf_salientes, saldo_final,
        gasto_estimado, limite_indexado, monto_aprobado, comentario, porcentaje_concilio, gasto_por_porcentaje, saldo_corte, ajustes, porcentaje_junta, saldo_aprobado_junta
    from jsonb_to_recordset(p_departamentos) x(departamento_id uuid, porcentaje_asignado numeric, ingresos numeric, gasto numeric, gastos_miscelaneos numeric,
        ingresos_directos numeric, transf_entrantes numeric, transf_salientes numeric, saldo_final numeric, gasto_estimado numeric, limite_indexado numeric,
        monto_aprobado numeric, comentario text, porcentaje_concilio numeric, gasto_por_porcentaje numeric, saldo_corte numeric, ajustes numeric,
        porcentaje_junta numeric, saldo_aprobado_junta numeric);
    update presupuesto_encabezado set resumen = p_resumen where id = p_id;

  elsif e.estado = 'en_revision' and p_nuevo = 'aprobado' then
    if v_rol not in ('superadmin','tesorero','junta') then raise exception 'Tu rol no puede aprobar.'; end if;
  elsif e.estado = 'en_revision' and p_nuevo = 'borrador' then
    if v_rol not in ('superadmin','tesorero') then raise exception 'Tu rol no puede reabrir el borrador.'; end if;
  elsif e.estado = 'aprobado' and p_nuevo = 'borrador' then
    if v_rol <> 'superadmin' then raise exception 'Solo el superadmin puede reabrir un presupuesto aprobado.'; end if;
  else
    raise exception 'Transición no permitida: % → %.', e.estado, p_nuevo;
  end if;

  update presupuesto_encabezado set estado = p_nuevo, fase_actual = case when p_nuevo = 'aprobado' then 5 else fase_actual end where id = p_id;
end $$;

-- ---------- 6. PERMISOS ----------
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.departamentos to authenticated;
grant insert, update, delete on public.iglesias, public.usuarios_autorizados, public.usuario_iglesias to authenticated;  -- filtrado por RLS (superadmin)
grant delete on public.presupuesto_encabezado to authenticated;                                                          -- solo superadmin (RLS)
grant execute on all functions in schema public to authenticated;

-- ---------- 7. PRIMER USO (descomenta, cambia datos y ejecuta) ----------
-- with i as (insert into public.iglesias (nombre, distrito, asociacion) values ('Iglesia Central de Monterrey','Distrito X','Asociación Y') returning id)
-- insert into public.usuarios_autorizados (email, nombre, rol, iglesia_id)
-- select 'tu_correo@gmail.com', 'Tu Nombre', 'superadmin', id from i;
-- Usuarios nuevos: insert en usuarios_autorizados (+ filas en usuario_iglesias si operan más de una iglesia).
-- NOTA: después de este script, ejecutar también 02_agrupaciones.sql (memoria de agrupación de la Fase 1).
-- NOTA: después de 02_agrupaciones.sql, ejecutar 03_departamentos_sin_catalogo.sql (elimina el catálogo de departamentos; los departamentos vienen de la Plantilla 5).
