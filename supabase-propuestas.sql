-- Parte 5: propuestas de tragos de los invitados.
-- Requiere las partes anteriores. Pegá todo en el SQL Editor y ejecutalo una vez.

create table public.propuestas (
  id bigint generated always as identity primary key,
  nombre text not null,
  ingredientes text,
  autor text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'descartada')),
  creada_en timestamptz not null default now()
);

-- Sin políticas: la tabla es invisible desde la web.
-- Solo se entra por las funciones de abajo.
alter table public.propuestas enable row level security;

-- Cualquier invitado puede dejar una propuesta (no necesita clave)
create or replace function public.proponer_trago(
  p_nombre text,
  p_ingredientes text,
  p_autor text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'falta el nombre del trago';
  end if;

  insert into propuestas (nombre, ingredientes, autor)
  values (
    left(trim(p_nombre), 60),
    nullif(left(trim(coalesce(p_ingredientes, '')), 200), ''),
    nullif(left(trim(coalesce(p_autor, '')), 40), '')
  );
end;
$$;

-- Las propuestas pendientes solo se leen con la clave de admin
create or replace function public.listar_propuestas(p_clave text)
returns setof propuestas
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admin_config where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;
  return query
    select * from propuestas where estado = 'pendiente' order by creada_en desc;
end;
$$;

-- Marca una propuesta como aprobada o descartada
create or replace function public.resolver_propuesta(
  p_id bigint,
  p_estado text,
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
  if p_estado not in ('aprobada', 'descartada') then
    raise exception 'estado invalido';
  end if;
  update propuestas set estado = p_estado where id = p_id;
end;
$$;
