-- 05_catalogo_departamentos.sql · Catálogo de departamentos por iglesia (Fase 3): habilitar, deshabilitar y crear.
-- Ejecutar UNA vez en Supabase > SQL Editor (query NUEVA y en blanco), después de 04_acceso_y_perfiles.sql. Es seguro re-ejecutarlo.
--
-- El catálogo solo define QUÉ departamentos existen y si están habilitados para la iglesia.
-- Los valores (%, gasto, transferencias…) siguen guardándose con cada presupuesto, por NOMBRE (presupuesto_departamental.departamento_nombre).
-- Por eso deshabilitar un departamento NO altera presupuestos ya enviados a revisión o aprobados, y nunca se borra nada.

create table if not exists public.catalogo_departamentos (
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  clave text not null,                  -- nombre normalizado (minúsculas, sin acentos): evita duplicados como "Música" / "Musica"
  nombre text not null,                 -- nombre para mostrar
  activo boolean not null default true, -- habilitado = aparece en la Fase 3 de los presupuestos nuevos
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (iglesia_id, clave)
);
alter table public.catalogo_departamentos enable row level security;
drop policy if exists cat_sel on public.catalogo_departamentos;
create policy cat_sel on public.catalogo_departamentos for select to authenticated using (fn_tiene_iglesia(iglesia_id));
-- Sin políticas de escritura: solo la función de abajo (security definer) escribe.

-- Inserta o actualiza (por clave) los departamentos enviados. Nunca borra: "eliminar" = deshabilitar (activo = false).
create or replace function public.guardar_catalogo_departamentos(p_iglesia uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not fn_puede_editar(p_iglesia) then
    raise exception 'No tienes permiso para editar el catálogo de esta iglesia.' using errcode = '42501';
  end if;
  insert into catalogo_departamentos (iglesia_id, clave, nombre, activo, orden)
  select p_iglesia, trim(x.clave), trim(x.nombre), coalesce(x.activo, true), coalesce(x.orden, 0)
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) x(clave text, nombre text, activo boolean, orden int)
  where nullif(trim(x.clave), '') is not null and nullif(trim(x.nombre), '') is not null
  on conflict (iglesia_id, clave) do update
    set nombre = excluded.nombre, activo = excluded.activo, orden = excluded.orden, updated_at = now();
end $$;

revoke all on table public.catalogo_departamentos from anon;
grant select on public.catalogo_departamentos to authenticated;
revoke all on function public.guardar_catalogo_departamentos(uuid, jsonb) from anon, public;
grant execute on function public.guardar_catalogo_departamentos(uuid, jsonb) to authenticated;
