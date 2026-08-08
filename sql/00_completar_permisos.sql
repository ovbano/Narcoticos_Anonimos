-- Ejecuta este archivo UNA VEZ después del SQL inicial.
-- RLS seguirá controlando qué filas puede leer o modificar cada usuario.

grant usage on schema public to anon, authenticated;

grant select on table public.anniversaries to anon;
grant select on table public.service_contacts to anon;

grant select, insert, update, delete on table public.anniversaries to authenticated;
grant select, update on table public.service_contacts to authenticated;
grant select on table public.profiles to authenticated;

grant execute on function public.is_site_editor() to authenticated;
