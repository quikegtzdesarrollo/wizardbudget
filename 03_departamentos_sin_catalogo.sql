-- 03_departamentos_sin_catalogo.sql · Los departamentos ya NO son un catálogo guardado:
-- el nombre y los valores vienen de la Plantilla 5 (Fase 3) y se guardan con cada presupuesto.
-- Ejecutar UNA vez en Supabase > SQL Editor, después de setup.sql y 02_agrupaciones.sql.

-- 1. presupuesto_departamental guarda el NOMBRE del departamento (ya no referencia un catálogo)
alter table public.presupuesto_departamental add column if not exists departamento_nombre text;
alter table public.presupuesto_departamental add column if not exists orden int not null default 0;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'presupuesto_departamental' and column_name = 'departamento_id')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'departamentos') then
    update public.presupuesto_departamental pd set departamento_nombre = d.nombre from public.departamentos d where d.id = pd.departamento_id and pd.departamento_nombre is null;
  end if;
end $$;
update public.presupuesto_departamental set departamento_nombre = '(sin nombre)' where departamento_nombre is null;
alter table public.presupuesto_departamental drop column if exists departamento_id;          -- también elimina la llave primaria y la FK anteriores
alter table public.presupuesto_departamental alter column departamento_nombre set not null;
alter table public.presupuesto_departamental drop constraint if exists presupuesto_departamental_pkey;
alter table public.presupuesto_departamental add primary key (presupuesto_id, departamento_nombre);

-- 2. Se elimina el catálogo y su siembra automática de 7 departamentos
drop function if exists public.trg_seed_departamentos() cascade;
drop table if exists public.departamentos cascade;

-- 3. cambiar_estado: valida y guarda los departamentos por nombre
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
    if v_rol not in ('superadmin','tesorero','secretario') then raise exception 'Tu rol no puede enviar a revisión.'; end if;
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
