-- Parte 4: entrar al admin con clave + editar, pausar y eliminar tragos.
-- Requiere las partes anteriores. Pegá todo en el SQL Editor y ejecutalo una vez.

-- Valida la clave al entrar a la página de admin
create or replace function public.validar_clave(p_clave text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admin_config where clave = p_clave);
$$;

-- Edita un trago y reemplaza sus ingredientes
create or replace function public.editar_trago(
  p_id bigint,
  p_seccion text,
  p_nombre text,
  p_nota text,
  p_ingredientes_texto text,
  p_ingredientes text[],
  p_clave text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;

  update tragos
  set seccion = p_seccion,
      nombre = p_nombre,
      nota = nullif(trim(coalesce(p_nota, '')), ''),
      ingredientes = p_ingredientes_texto
  where id = p_id;

  delete from trago_ingredientes where trago_id = p_id;

  foreach v_nombre in array p_ingredientes loop
    insert into ingredientes (nombre) values (v_nombre)
    on conflict (nombre) do nothing;

    insert into trago_ingredientes (trago_id, ingrediente_id)
    select p_id, id from ingredientes where nombre = v_nombre
    on conflict do nothing;
  end loop;
end;
$$;

-- Pausa o reanuda un trago (visible = false lo saca de la carta)
create or replace function public.pausar_trago(
  p_id bigint,
  p_visible boolean,
  p_clave text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;
  update tragos set visible = p_visible where id = p_id;
end;
$$;

-- Elimina un trago (sus relaciones se borran solas por on delete cascade)
create or replace function public.eliminar_trago(
  p_id bigint,
  p_clave text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;
  delete from tragos where id = p_id;
end;
$$;
