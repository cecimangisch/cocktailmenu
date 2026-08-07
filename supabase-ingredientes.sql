-- Parte 2: ingredientes y disponibilidad de tragos.
-- Requiere haber ejecutado antes supabase-setup.sql.
-- IMPORTANTE: reemplazá 'CAMBIA-ESTA-CLAVE' por la clave que quieras usar
-- en la página de configuración, y después pegá todo en el SQL Editor.

create table public.ingredientes (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  disponible boolean not null default true
);

create table public.trago_ingredientes (
  trago_id bigint not null references public.tragos (id) on delete cascade,
  ingrediente_id bigint not null references public.ingredientes (id) on delete cascade,
  primary key (trago_id, ingrediente_id)
);

alter table public.ingredientes enable row level security;
alter table public.trago_ingredientes enable row level security;
create policy "lectura publica de ingredientes" on public.ingredientes
  for select using (true);
create policy "lectura publica de relaciones" on public.trago_ingredientes
  for select using (true);

-- Clave de administración: tabla sin políticas = invisible desde la web.
-- Solo la función de abajo (security definer) puede leerla.
create table public.admin_config (clave text not null);
alter table public.admin_config enable row level security;
insert into public.admin_config (clave) values ('CAMBIA-ESTA-CLAVE');

create or replace function public.marcar_ingrediente(
  p_id bigint,
  p_disponible boolean,
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
  update ingredientes set disponible = p_disponible where id = p_id;
end;
$$;

-- Ingredientes de los tragos actuales
insert into public.ingredientes (nombre) values
  ('Vodka'), ('Licor de Café'), ('Baileys'), ('Espresso'),
  ('Vermouth'), ('Campari'), ('Gin'), ('Tónica'),
  ('Tequila'), ('Cointreau'), ('Lima'), ('Syrup'),
  ('Granadina'), ('Naranja sanguina'), ('Ginger beer'),
  ('Ron especiado'), ('Maracuyá'), ('Naranja'),
  ('Pepino'), ('Frutos rojos');

-- Qué ingredientes necesita cada trago (Pepino y Frutos rojos son
-- opcionales del Gin Tonic, no lo bloquean si faltan)
insert into public.trago_ingredientes (trago_id, ingrediente_id)
select t.id, i.id
from public.tragos t
join public.ingredientes i on
  (t.nombre = 'Espresso Martini' and i.nombre in ('Vodka', 'Licor de Café', 'Baileys', 'Espresso')) or
  (t.nombre = 'Negroni'          and i.nombre in ('Vermouth', 'Campari', 'Gin')) or
  (t.nombre = 'Gin Tonic'        and i.nombre in ('Gin', 'Tónica')) or
  (t.nombre = 'Margarita'        and i.nombre in ('Tequila', 'Cointreau', 'Lima', 'Syrup')) or
  (t.nombre = 'Luqui''s Negroni' and i.nombre in ('Vermouth', 'Campari', 'Granadina')) or
  (t.nombre = 'Coral Sunset'     and i.nombre in ('Tequila', 'Naranja sanguina', 'Lima')) or
  (t.nombre = 'Seaside Mule'     and i.nombre in ('Vodka', 'Ginger beer', 'Lima')) or
  (t.nombre = 'Tropical Storm'   and i.nombre in ('Ron especiado', 'Maracuyá', 'Naranja'));
