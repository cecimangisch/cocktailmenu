-- Parte 3: función para agregar un trago completo desde la página de admin.
-- Requiere haber ejecutado supabase-setup.sql y supabase-ingredientes.sql.
-- Pegá todo en el SQL Editor y ejecutalo una vez.

create or replace function public.agregar_trago(
  p_seccion text,
  p_nombre text,
  p_nota text,
  p_ingredientes_texto text,
  p_ingredientes text[],
  p_clave text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_nombre text;
  v_orden int;
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;

  -- el trago nuevo va al final de su sección
  select coalesce(max(orden), 0) + 1 into v_orden
  from tragos where seccion = p_seccion;

  insert into tragos (seccion, nombre, nota, ingredientes, orden)
  values (p_seccion, p_nombre, nullif(trim(coalesce(p_nota, '')), ''), p_ingredientes_texto, v_orden)
  returning id into v_id;

  -- crea los ingredientes que no existan y arma las relaciones
  foreach v_nombre in array p_ingredientes loop
    insert into ingredientes (nombre) values (v_nombre)
    on conflict (nombre) do nothing;

    insert into trago_ingredientes (trago_id, ingrediente_id)
    select v_id, id from ingredientes where nombre = v_nombre
    on conflict do nothing;
  end loop;

  return v_id;
end;
$$;
