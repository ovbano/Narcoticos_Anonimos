-- Ejecutado en Supabase. Conserva la clave histórica de Tesorería para compatibilidad.
begin;
alter table public.service_contacts drop constraint service_contacts_role_check;
alter table public.service_contacts add constraint service_contacts_role_check check (role in ('rsg_principal','rsg_alterno','secretaria_tesoreria','secretaria','cafeteria','literatura','linea_telefonica'));
insert into public.service_contacts(role,name,phone,active) values
 ('secretaria','','',false), ('cafeteria','','',false),
 ('literatura','','',false), ('linea_telefonica','','',false)
on conflict(role) do nothing;
commit;
