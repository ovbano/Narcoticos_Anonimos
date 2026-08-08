-- Datos actuales del Grupo Amigos Verdaderos.
-- Ejecuta este archivo SOLO si la tabla anniversaries todavía está vacía.

insert into public.anniversaries
(name, recovery_day, recovery_month, recovery_year, celebration_date, celebration_location, celebration_latitude, celebration_longitude, celebration_map_url, public_visible)
select * from (values
  ('Valentín Baño',      2,  1, 2018, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Luis Franco',       20,  1, 2011, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Eduardo Mazano',    30,  1, 2012, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Javier Guerrero',   17,  2, 2026, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Germania Sanchéz',  16,  3, 2019, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Geovanny Mendoza',   6,  3, 2017, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Andrés',             28,  4, 2025, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Javier Lopéz',        5,  5, null, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Estuard Losano',      2,  5, 2026, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Byron Celi',          3,  6, 2012, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Óscar Celi',         13,  6, 2013, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Alberto',            16,  7, null, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Víctor Quevedo',     12,  8, 2025, '2026-08-15'::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Fernando Morales',   23,  9, 2020, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Francisco Sanchéz',  28,  9, 2014, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Rolando Sanchéz',    13,  9, null, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Juan Carlos',        11, 11, 2018, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Stalin',             20, 11, 2025, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Junior Viteri',       5, 12, 2017, null::date, null::text, null::numeric, null::numeric, null::text, true),
  ('Ernesto Galarza',    27, 12, null, null::date, null::text, null::numeric, null::numeric, null::text, true)
) as v(name, recovery_day, recovery_month, recovery_year, celebration_date, celebration_location, celebration_latitude, celebration_longitude, celebration_map_url, public_visible)
where not exists (
  select 1
  from public.anniversaries a
  where lower(a.name) = lower(v.name)
    and a.recovery_day = v.recovery_day
    and a.recovery_month = v.recovery_month
);
