-- Ejecutar una vez en el SQL Editor de Supabase. No cambia políticas ni permisos.
-- Los registros existentes permanecen sin ubicación confirmada.
begin;
alter table public.anniversaries
  add column if not exists celebration_message text,
  add column if not exists celebration_location_confirmed boolean not null default false;
comment on column public.anniversaries.celebration_message is 'Mensaje público de la celebración programada; no comentarios de visitantes.';
comment on column public.anniversaries.celebration_location_confirmed is 'Confirmación explícita para publicar el mapa de la celebración.';
commit;
