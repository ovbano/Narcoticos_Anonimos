-- Hora local de Ecuador; vacío significa que todavía no está definida.
alter table public.anniversaries
  add column if not exists celebration_time time without time zone;
comment on column public.anniversaries.celebration_time is
  'Hora local de Ecuador de la celebración programada. NULL cuando está por confirmar.';
