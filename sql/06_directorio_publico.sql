-- Directorio público de reuniones. No almacena información de miembros ni tesorería.
begin;
create table if not exists public.public_meetings (
 id uuid primary key default gen_random_uuid(),
 group_name text not null check (length(btrim(group_name)) between 1 and 120),
 city text not null check (length(btrim(city)) between 1 and 120),
 address text not null check (length(btrim(address)) between 1 and 250),
 weekdays integer[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6] and array_position(weekdays,null) is null),
 meeting_time time without time zone not null,
 notes text not null default '' check (length(notes)<=500),
 map_url text not null default '' check (map_url='' or (map_url ~ '^https://' and length(map_url)<=1500)),
 contact_phone text not null default '' check (contact_phone='' or contact_phone ~ '^\+?[0-9 ()-]{7,30}$'),
 exact_location boolean not null default false,
 source_url text not null default '' check (source_url='' or (source_url ~ '^https://' and length(source_url)<=1500)),
 verified_at timestamptz,
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint public_meetings_verified_publication check (not published or (verified_at is not null and source_url<>'')),
 constraint public_meetings_schedule_key unique(group_name,city,meeting_time)
);
alter table public.public_meetings enable row level security;
revoke all on public.public_meetings from anon,authenticated;
grant select on public.public_meetings to anon,authenticated;
grant insert,update on public.public_meetings to authenticated;
create policy "Publicar solo reuniones verificadas" on public.public_meetings for select to anon using (published);
create policy "Lectura de reuniones para editores" on public.public_meetings for select to authenticated using (published or (select public.is_site_editor()));
create policy "Crear reuniones como editor" on public.public_meetings for insert to authenticated with check ((select public.is_site_editor()));
create policy "Actualizar reuniones como editor" on public.public_meetings for update to authenticated using ((select public.is_site_editor())) with check ((select public.is_site_editor()));
insert into public.public_meetings(group_name,city,address,weekdays,meeting_time,notes,map_url,exact_location,source_url,verified_at,published)
values('Amigos Verdaderos','Santo Domingo','Parroquia Luz de América',array[2,4,6],'20:00','Se esperan 10 minutos para dar inicio. Confirma con el grupo la dirección exacta.','https://www.google.com/maps/search/?api=1&query=Luz+de+Am%C3%A9rica%2C+Santo+Domingo%2C+Ecuador',false,'https://narcoticos-anonimos-azure.vercel.app/',now(),true)
on conflict(group_name,city,meeting_time) do nothing;
commit;
