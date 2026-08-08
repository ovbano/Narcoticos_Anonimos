-- IMPORTANTE:
-- Reemplaza TU_CORREO_AQUI por el correo del usuario que ya creaste en
-- Authentication > Users. Luego ejecuta este SQL UNA SOLA VEZ.

insert into public.profiles (id, display_name, role, active, updated_at)
select
  id,
  'Administrador Amigos Verdaderos',
  'admin',
  true,
  now()
from auth.users
where lower(email) = lower('TU_CORREO_AQUI')
on conflict (id) do update set
  display_name = excluded.display_name,
  role = 'admin',
  active = true,
  updated_at = now();

-- Verificación: debe devolver una fila con role = admin y active = true.
select p.id, u.email, p.display_name, p.role, p.active
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('guerrerovalentin76@gmail.com');
