-- 04_acceso_y_perfiles.sql · Registro de quienes inician sesión, solicitud de perfil/iglesia, roles nuevos y administración de usuarios.
-- Ejecutar UNA vez en Supabase > SQL Editor, después de 03_departamentos_sin_catalogo.sql.

-- 1. ROLES: superadmin + los 4 perfiles (los roles anteriores se convierten)
update public.usuarios_autorizados set rol = case rol
  when 'secretario' then 'tesorero' when 'director' then 'director_mayordomia' when 'junta' then 'anciano_asesor' else rol end;
alter table public.usuarios_autorizados drop constraint if exists usuarios_autorizados_rol_check;
alter table public.usuarios_autorizados add constraint usuarios_autorizados_rol_check
  check (rol in ('superadmin','pastor','tesorero','director_mayordomia','anciano_asesor'));

-- 2. REGISTRO de todas las personas que han iniciado sesión (tengan o no acceso) y lo que solicitaron
create table if not exists public.usuarios_registrados (
  email text primary key,                               -- en minúsculas
  nombre text,
  perfil_solicitado text check (perfil_solicitado in ('pastor','tesorero','director_mayordomia','anciano_asesor')),
  iglesia_solicitada_id uuid references public.iglesias(id) on delete set null,
  solicitud_en timestamptz,
  primer_login timestamptz not null default now(),
  ultimo_login timestamptz not null default now()
);
alter table public.usuarios_registrados enable row level security;
drop policy if exists reg_sel on public.usuarios_registrados;
create policy reg_sel on public.usuarios_registrados for select to authenticated
  using (email = fn_email() or fn_rol() = 'superadmin');
-- Sin políticas de escritura: solo las funciones de abajo (security definer) escriben.

-- 3. PERMISOS POR ROL: un solo lugar para ajustarlos
create or replace function public.fn_rol_puede(p_accion text) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_accion
    when 'editar'  then fn_rol() in ('superadmin','tesorero','director_mayordomia')
    when 'enviar'  then fn_rol() in ('superadmin','tesorero','director_mayordomia')
    when 'aprobar' then fn_rol() in ('superadmin','tesorero','pastor','anciano_asesor')
    when 'reabrir' then fn_rol() in ('superadmin','tesorero')
    else false end $$;

create or replace function public.fn_puede_editar(p uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select fn_tiene_iglesia(p) and fn_rol_puede('editar') $$;

-- 4. CONTEXTO DE SESIÓN: registra el acceso y devuelve 'activo' | 'pendiente' | 'inactivo'
create or replace function public.mi_contexto() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := fn_email(); v_nombre text; u usuarios_autorizados; r usuarios_registrados; v_ig jsonb; v_cat jsonb;
begin
  if v_email = '' then return null; end if;
  v_nombre := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''), split_part(v_email, '@', 1));
  insert into usuarios_registrados (email, nombre) values (v_email, v_nombre)
  on conflict (email) do update set nombre = excluded.nombre, ultimo_login = now();
  select * into r from usuarios_registrados where email = v_email;

  select * into u from usuarios_autorizados where email = v_email and activo;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre) order by i.nombre), '[]'::jsonb) into v_ig
      from iglesias i where i.activa and (u.rol = 'superadmin' or exists (select 1 from usuario_iglesias ui where ui.usuario_id = u.id and ui.iglesia_id = i.id));
    return jsonb_build_object('acceso', 'activo',
      'usuario', jsonb_build_object('id', u.id, 'email', u.email, 'nombre', u.nombre, 'rol', u.rol),
      'iglesias', v_ig, 'solicitud', jsonb_build_object('perfil', r.perfil_solicitado, 'iglesia_id', r.iglesia_solicitada_id));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre) order by i.nombre), '[]'::jsonb) into v_cat from iglesias i where i.activa;
  return jsonb_build_object(
    'acceso', case when exists (select 1 from usuarios_autorizados where email = v_email and not activo) then 'inactivo' else 'pendiente' end,
    'usuario', jsonb_build_object('email', v_email, 'nombre', v_nombre, 'rol', null), 'iglesias', '[]'::jsonb,
    'solicitud', jsonb_build_object('perfil', r.perfil_solicitado, 'iglesia_id', r.iglesia_solicitada_id,
                                    'iglesia_nombre', (select nombre from iglesias where id = r.iglesia_solicitada_id)),
    'catalogo_iglesias', v_cat);
end $$;

-- 5. La persona elige su perfil e iglesia (solicitud; NO concede acceso)
create or replace function public.guardar_solicitud(p_perfil text, p_iglesia uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if fn_email() = '' then raise exception 'Sesión no válida.'; end if;
  if p_perfil is null or p_perfil not in ('pastor','tesorero','director_mayordomia','anciano_asesor') then raise exception 'Perfil no válido.'; end if;
  if not exists (select 1 from iglesias where id = p_iglesia and activa) then raise exception 'Iglesia no válida.'; end if;
  update usuarios_registrados set perfil_solicitado = p_perfil, iglesia_solicitada_id = p_iglesia, solicitud_en = now() where email = fn_email();
  if not found then raise exception 'Registro de sesión no encontrado; vuelve a iniciar sesión.'; end if;
end $$;

-- 6. MÓDULO SUPERADMIN: listar personas (registradas y/o autorizadas) y dar/editar acceso
create or replace function public.admin_listar_usuarios() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if fn_rol() <> 'superadmin' then raise exception 'Solo el superadmin puede ver los usuarios.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by (t.estado = 'pendiente') desc, t.ultimo_login desc nulls last, t.email) from (
    select coalesce(r.email, u.email) as email, coalesce(u.nombre, r.nombre) as nombre,
           r.perfil_solicitado, r.iglesia_solicitada_id,
           (select nombre from iglesias where id = r.iglesia_solicitada_id) as iglesia_solicitada,
           r.primer_login, r.ultimo_login, u.rol,
           case when u.id is null then 'pendiente' when u.activo then 'activo' else 'inactivo' end as estado,
           coalesce((select jsonb_agg(ui.iglesia_id) from usuario_iglesias ui where ui.usuario_id = u.id), '[]'::jsonb) as iglesias
    from usuarios_registrados r full join usuarios_autorizados u on u.email = r.email) t), '[]'::jsonb);
end $$;

create or replace function public.admin_guardar_acceso(p_email text, p_nombre text, p_rol text, p_iglesias uuid[], p_activo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_id uuid;
begin
  if fn_rol() <> 'superadmin' then raise exception 'Solo el superadmin puede administrar usuarios.' using errcode = '42501'; end if;
  if v_email is null or v_email = '' then raise exception 'Correo requerido.'; end if;
  if p_rol is null or p_rol not in ('superadmin','pastor','tesorero','director_mayordomia','anciano_asesor') then raise exception 'Rol no válido.'; end if;
  if v_email = fn_email() and (p_rol <> 'superadmin' or not coalesce(p_activo, true)) then raise exception 'No puedes quitarte tu propio acceso de superadmin.'; end if;
  if p_rol <> 'superadmin' and coalesce(p_activo, true) and coalesce(array_length(p_iglesias, 1), 0) = 0 then raise exception 'Asigna al menos una iglesia.'; end if;

  insert into usuarios_autorizados (email, nombre, rol, activo, iglesia_id)
  values (v_email, coalesce(nullif(trim(p_nombre), ''), split_part(v_email, '@', 1)), p_rol, coalesce(p_activo, true), p_iglesias[1])
  on conflict (email) do update set nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo, iglesia_id = excluded.iglesia_id
  returning id into v_id;

  delete from usuario_iglesias where usuario_id = v_id;
  insert into usuario_iglesias (usuario_id, iglesia_id) select v_id, x from unnest(coalesce(p_iglesias, '{}'::uuid[])) as x on conflict do nothing;
end $$;

-- 7. cambiar_estado ahora consulta fn_rol_puede() (mismo comportamiento + roles nuevos)
create or replace function public.cambiar_estado(p_id uuid, p_nuevo text, p_resumen jsonb default null,
  p_historico jsonb default null, p_departamentos jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare e presupuesto_encabezado; v_rol text; v_tp numeric; v_te numeric; v_ts numeric; v_tc numeric;
begin
  select * into e from presupuesto_encabezado where id = p_id for update;
  if not found then raise exception 'Presupuesto no encontrado.'; end if;
  if not fn_tiene_iglesia(e.iglesia_id) then raise exception 'Sin acceso a esta iglesia.' using errcode = '42501'; end if;
  v_rol := fn_rol();

  if e.estado = 'borrador' and p_nuevo = 'en_revision' then
    if not fn_rol_puede('enviar') then raise exception 'Tu rol no puede enviar a revisión.'; end if;
    if p_historico is null or jsonb_array_length(p_historico) = 0 then raise exception 'Falta la ejecución mensual (Fase 2).'; end if;
    if p_departamentos is null or jsonb_array_length(p_departamentos) = 0 then raise exception 'Faltan los departamentos (Fase 3).'; end if;
    if exists (select 1 from jsonb_to_recordset(p_departamentos) x(departamento text) where nullif(trim(x.departamento), '') is null) then
      raise exception 'Todos los departamentos deben tener nombre.';
    end if;
    if exists (select 1 from jsonb_to_recordset(p_departamentos) x(departamento text) group by lower(trim(x.departamento)) having count(*) > 1) then
      raise exception 'Hay departamentos repetidos.';
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
    insert into presupuesto_departamental (presupuesto_id, departamento_nombre, orden, porcentaje_asignado, ingresos, gasto, gastos_miscelaneos, ingresos_directos,
        transf_entrantes, transf_salientes, saldo_final, gasto_estimado, limite_indexado, monto_aprobado, comentario_ajuste, porcentaje_concilio,
        gasto_por_porcentaje, saldo_corte, ajustes, porcentaje_junta, saldo_aprobado_junta)
    select p_id, trim(departamento), coalesce(orden, 0), porcentaje_asignado, ingresos, gasto, gastos_miscelaneos, ingresos_directos, transf_entrantes, transf_salientes, saldo_final,
        gasto_estimado, limite_indexado, monto_aprobado, comentario, porcentaje_concilio, gasto_por_porcentaje, saldo_corte, ajustes, porcentaje_junta, saldo_aprobado_junta
    from jsonb_to_recordset(p_departamentos) x(departamento text, orden int, porcentaje_asignado numeric, ingresos numeric, gasto numeric, gastos_miscelaneos numeric,
        ingresos_directos numeric, transf_entrantes numeric, transf_salientes numeric, saldo_final numeric, gasto_estimado numeric, limite_indexado numeric,
        monto_aprobado numeric, comentario text, porcentaje_concilio numeric, gasto_por_porcentaje numeric, saldo_corte numeric, ajustes numeric,
        porcentaje_junta numeric, saldo_aprobado_junta numeric);
    update presupuesto_encabezado set resumen = p_resumen where id = p_id;

  elsif e.estado = 'en_revision' and p_nuevo = 'aprobado' then
    if not fn_rol_puede('aprobar') then raise exception 'Tu rol no puede aprobar.'; end if;
  elsif e.estado = 'en_revision' and p_nuevo = 'borrador' then
    if not fn_rol_puede('reabrir') then raise exception 'Tu rol no puede reabrir el borrador.'; end if;
  elsif e.estado = 'aprobado' and p_nuevo = 'borrador' then
    if v_rol <> 'superadmin' then raise exception 'Solo el superadmin puede reabrir un presupuesto aprobado.'; end if;
  else
    raise exception 'Transición no permitida: % → %.', e.estado, p_nuevo;
  end if;

  update presupuesto_encabezado set estado = p_nuevo, fase_actual = case when p_nuevo = 'aprobado' then 5 else fase_actual end where id = p_id;
end $$;

-- 8. PERMISOS
revoke all on table public.usuarios_registrados from anon;
grant select on public.usuarios_registrados to authenticated;
revoke all on function public.fn_rol_puede(text), public.mi_contexto(), public.guardar_solicitud(text, uuid),
  public.admin_listar_usuarios(), public.admin_guardar_acceso(text, text, text, uuid[], boolean) from anon, public;
grant execute on function public.fn_rol_puede(text), public.mi_contexto(), public.guardar_solicitud(text, uuid),
  public.admin_listar_usuarios(), public.admin_guardar_acceso(text, text, text, uuid[], boolean) to authenticated;
