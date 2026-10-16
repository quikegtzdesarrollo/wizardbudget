-- reset_cargas.sql · Borra TODO lo cargado para volver a empezar de cero con las cargas.
-- NO es una migración: no forma parte del orden setup → 02 → 03 → 04 → 05. Ejecútalo solo cuando quieras reiniciar.
-- Ejecutar en Supabase > SQL Editor, en una pestaña NUEVA y en blanco. ES IRREVERSIBLE: si dudas, haz antes un respaldo.
--
-- QUÉ BORRA
--   · presupuesto_encabezado      → presupuestos (año, inflación, estado…)
--   · presupuesto_datos           → borradores completos del asistente (aquí viven las cargas de las Plantillas 1 a 5)
--   · historico_ejecucion         → Fase 2 materializada al enviar a revisión
--   · presupuesto_departamental   → Fases 3 a 5 materializadas
--   · agrupaciones_uf             → memoria de agrupación miembro → UF (Fase 1)
--   · catalogo_departamentos      → catálogo de departamentos (si no lo quieres borrar, pon v_borrar_catalogo := false)
-- QUÉ NO TOCA
--   · iglesias, usuarios_autorizados, usuario_iglesias, usuarios_registrados (usuarios, accesos, perfiles e iglesias quedan intactos)
--
-- ALCANCE: v_iglesia := null borra TODAS las iglesias. Para reiniciar solo una, pon su id (consúltalo con: select id, nombre from public.iglesias;).

do $$
declare
  v_iglesia uuid := null;                 -- null = todas las iglesias | '00000000-0000-0000-0000-000000000000' = solo esa
  v_borrar_catalogo boolean := true;      -- false = conservar el catálogo de departamentos
begin
  -- Presupuestos: los hijos primero (también caerían en cascada al borrar el encabezado).
  delete from public.presupuesto_departamental where presupuesto_id in (select id from public.presupuesto_encabezado where v_iglesia is null or iglesia_id = v_iglesia);
  delete from public.historico_ejecucion       where presupuesto_id in (select id from public.presupuesto_encabezado where v_iglesia is null or iglesia_id = v_iglesia);
  delete from public.presupuesto_datos         where presupuesto_id in (select id from public.presupuesto_encabezado where v_iglesia is null or iglesia_id = v_iglesia);
  delete from public.presupuesto_encabezado    where v_iglesia is null or iglesia_id = v_iglesia;

  -- Memoria de agrupación de la Fase 1 (script 02).
  if to_regclass('public.agrupaciones_uf') is not null then
    delete from public.agrupaciones_uf where v_iglesia is null or iglesia_id = v_iglesia;
  end if;

  -- Catálogo de departamentos (script 05).
  if v_borrar_catalogo and to_regclass('public.catalogo_departamentos') is not null then
    delete from public.catalogo_departamentos where v_iglesia is null or iglesia_id = v_iglesia;
  end if;
end $$;

-- Verificación: filas que quedan en cada tabla de carga (si v_iglesia es null, todas deben mostrar 0).
select table_name as tabla,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int as filas
from information_schema.tables
where table_schema = 'public'
  and table_name in ('presupuesto_encabezado','presupuesto_datos','historico_ejecucion','presupuesto_departamental','agrupaciones_uf','catalogo_departamentos')
order by table_name;
