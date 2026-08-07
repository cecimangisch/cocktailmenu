-- Configuración de la base de datos del menú.
-- Pegá todo este archivo en el SQL Editor de Supabase y ejecutalo una sola vez.

create table public.tragos (
  id bigint generated always as identity primary key,
  seccion text not null check (seccion in ('clasicos', 'especiales')),
  nombre text not null,
  nota text,
  ingredientes text not null,
  orden int not null default 0,
  visible boolean not null default true
);

-- Lectura pública (el sitio solo lee; escribir requiere entrar al panel de Supabase)
alter table public.tragos enable row level security;
create policy "lectura publica del menu" on public.tragos
  for select using (true);

-- Menú inicial
insert into public.tragos (seccion, nombre, nota, ingredientes, orden) values
  ('clasicos',   'Espresso Martini', null,                'Vodka, Licor de Café, Bailys, Shot de espresso', 1),
  ('clasicos',   'Negroni',          'Normal, Sbagliato', 'Vermouth, Campari, Gin',                         2),
  ('clasicos',   'Gin Tonic',        null,                'Gin, Tónica, Pepino/Frutos Rojos/Lima',          3),
  ('clasicos',   'Margarita',        'Spicy OPC',         'Tequila, Cointreau, Lima, Syrup',                4),
  ('especiales', 'Luqui''s Negroni', null,                'Vermouth, Campari, Granadina',                   1),
  ('especiales', 'Coral Sunset',     null,                'Tequila, blood orange, lime',                    2),
  ('especiales', 'Seaside Mule',     null,                'Vodka, ginger beer, lime',                       3),
  ('especiales', 'Tropical Storm',   null,                'Spiced rum, passionfruit, orange',               4);
