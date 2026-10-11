-- 02_agrupaciones.sql · Memoria de agrupación miembro → UF por iglesia (Fase 1)
-- Ejecutar UNA vez en Supabase > SQL Editor, después de setup.sql. Es seguro re-ejecutarlo.
create table if not exists public.agrupaciones_uf (
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  miembro_key text not null,            -- nombre del miembro normalizado (minúsculas, sin acentos)
  miembro_nombre text not null,
  uf_key text not null,                 -- nombre de la UF normalizado
  uf_nombre text not null,
  updated_at timestamptz not null default now(),
  primary key (iglesia_id, miembro_key)
);
alter table public.agrupaciones_uf enable row level security;
drop policy if exists agr_sel on public.agrupaciones_uf;
create policy agr_sel on public.agrupaciones_uf for select to authenticated using (fn_tiene_iglesia(iglesia_id));

-- Reemplaza la agrupación de los miembros enviados (p_claves) y guarda los pares vigentes (p_pares).
-- Los miembros de años anteriores que no vengan en p_claves conservan su agrupación.
create or replace function public.guardar_agrupaciones(p_iglesia uuid, p_pares jsonb, p_claves jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not fn_puede_editar(p_iglesia) then
    raise exception 'No tienes permiso para editar esta iglesia.' using errcode = '42501';
  end if;
  delete from agrupaciones_uf where iglesia_id = p_iglesia
    and miembro_key in (select jsonb_array_elements_text(coalesce(p_claves, '[]'::jsonb)));
  insert into agrupaciones_uf (iglesia_id, miembro_key, miembro_nombre, uf_key, uf_nombre)
  select p_iglesia, miembro_key, miembro_nombre, uf_key, uf_nombre
  from jsonb_to_recordset(coalesce(p_pares, '[]'::jsonb)) x(miembro_key text, miembro_nombre text, uf_key text, uf_nombre text)
  on conflict (iglesia_id, miembro_key) do update
    set miembro_nombre = excluded.miembro_nombre, uf_key = excluded.uf_key, uf_nombre = excluded.uf_nombre, updated_at = now();
end $$;

revoke all on table public.agrupaciones_uf from anon;
grant select on public.agrupaciones_uf to authenticated;
revoke all on function public.guardar_agrupaciones(uuid, jsonb, jsonb) from anon, public;
grant execute on function public.guardar_agrupaciones(uuid, jsonb, jsonb) to authenticated;
