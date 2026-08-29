-- Parte 6: tercera sección "Clásicos" (tragos básicos) + limpieza de ingredientes.
-- Requiere las partes anteriores. Pegá todo en el SQL Editor y ejecutalo una vez.

-- ===== Renombrar las secciones para que los nombres sean claros =====
-- Antes: clasicos = los cocktails, especiales = los de autor.
-- Ahora:  cocktails | autor | clasicos (estos últimos son los básicos).
alter table public.tragos drop constraint if exists tragos_seccion_check;

update public.tragos set seccion = 'cocktails' where seccion = 'clasicos';
update public.tragos set seccion = 'autor' where seccion = 'especiales';

alter table public.tragos add constraint tragos_seccion_check
  check (seccion in ('cocktails', 'autor', 'clasicos'));

-- ===== Ingredientes de los básicos =====
insert into public.ingredientes (nombre) values
  ('Ron blanco'), ('Coca'), ('Fernet'), ('Sprite'), ('Whisky')
on conflict (nombre) do nothing;

-- ===== Tragos clásicos =====
insert into public.tragos (seccion, nombre, nota, ingredientes, orden) values
  ('clasicos', 'Cuba Libre',      null, 'Ron blanco, Coca, lima',  1),
  ('clasicos', 'Fernet con Coca', null, 'Fernet, Coca',            2),
  ('clasicos', 'Vodka Tonic',     null, 'Vodka, Tónica, lima',     3),
  ('clasicos', 'Campari Tonic',   null, 'Campari, Tónica, naranja', 4),
  ('clasicos', 'Whisky con Coca', null, 'Whisky, Coca',            5);

insert into public.trago_ingredientes (trago_id, ingrediente_id)
select t.id, i.id
from public.tragos t
join public.ingredientes i on
  (t.nombre = 'Cuba Libre'      and i.nombre in ('Ron blanco', 'Coca')) or
  (t.nombre = 'Fernet con Coca' and i.nombre in ('Fernet', 'Coca')) or
  (t.nombre = 'Vodka Tonic'     and i.nombre in ('Vodka', 'Tónica')) or
  (t.nombre = 'Campari Tonic'   and i.nombre in ('Campari', 'Tónica')) or
  (t.nombre = 'Whisky con Coca' and i.nombre in ('Whisky', 'Coca'))
where t.seccion = 'clasicos'
on conflict do nothing;

-- ===== Limpiar ingredientes que ya no usa ningún trago =====
create or replace function public.eliminar_ingredientes_sin_uso(p_clave text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados int;
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;

  with borrados as (
    delete from ingredientes i
    where not exists (
      select 1 from trago_ingredientes ti where ti.ingrediente_id = i.id
    )
    returning 1
  )
  select count(*) into v_borrados from borrados;

  return v_borrados;
end;
$$;
