-- Private treasury. Existing public website permissions are unchanged.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','editor','treasurer','auditor'));
create schema if not exists treasury_private;
revoke all on schema treasury_private from public, anon;
grant usage on schema treasury_private to authenticated;

create function public.treasury_access() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and role in ('admin','treasurer','auditor'));
$$;
revoke all on function public.treasury_access() from public,anon;
grant execute on function public.treasury_access() to authenticated;

create table public.treasury_settings (
 id boolean primary key default true check(id), start_month date not null check(extract(day from start_month)=1),
 opening_general bigint not null check(opening_general between 0 and 100000000),
 opening_rent bigint not null check(opening_rent between 0 and 100000000),
 note text not null check(length(note) between 5 and 1000), created_by uuid not null, created_at timestamptz not null default now()
);
create table public.treasury_members (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 80),
 start_month date not null check(extract(day from start_month)=1), end_month date check(extract(day from end_month)=1 and end_month>=start_month),
 monthly_cents integer not null default 1200 check(monthly_cents between 0 and 100000), created_at timestamptz not null default now()
);
create table public.treasury_entries (
 id uuid primary key, status text not null default 'draft' check(status in ('draft','posted','void')),
 entry_date date not null, kind text not null check(kind in ('income','expense')), fund text not null check(fund in ('general','rent')),
 category text not null check(category in ('seventh','rent_contribution','other_income','rent','supplies','literature','service','event','other_expense')),
 amount_cents bigint check(amount_cents between 1 and 100000000), description text not null default '' check(length(description)<=500),
 member_id uuid references public.treasury_members(id), member_name text, due_month date check(extract(day from due_month)=1),
 receipt_path text, no_receipt_reason text not null default '' check(length(no_receipt_reason)<=500),
 created_by uuid not null, created_at timestamptz not null default now(), updated_by uuid not null, updated_at timestamptz not null default now(),
 version integer not null default 1, posted_at timestamptz, void_reason text,
 check(status='draft' or (amount_cents is not null and length(trim(description))>=3)),
 check(status!='void' or length(trim(void_reason))>=5)
);
create index treasury_entries_date_idx on public.treasury_entries(entry_date,status);
create index treasury_entries_member_idx on public.treasury_entries(member_id,due_month) where status='posted';
create table public.treasury_closures (
 month date primary key check(extract(day from month)=1), summary jsonb not null,
 counted_cents bigint not null check(counted_cents between 0 and 100000000), difference_cents bigint not null,
 note text not null default '' check(length(note)<=2000), closed_by uuid not null, closed_name text not null, closed_at timestamptz not null default now()
);
create table public.treasury_audit (
 id bigint generated always as identity primary key, happened_at timestamptz not null default now(),
 actor uuid not null, actor_name text not null, action text not null, entity_id text not null, before_data jsonb, after_data jsonb
);
-- Read-only client access. Mutations go through a checked transaction with an audit trail.
do $$ declare t text; begin
 foreach t in array array['treasury_settings','treasury_members','treasury_entries','treasury_closures','treasury_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy treasury_read on public.%I for select to authenticated using ((select public.treasury_access()))',t);
 end loop;
end $$;

create function public.treasury_report(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s public.treasury_settings; result jsonb; begin
 if not public.treasury_access() then raise exception 'No tienes acceso a Tesorería.'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Mes inválido.'; end if;
 select * into s from public.treasury_settings;
 if s.id is null then return jsonb_build_object('configured',false); end if;
 if p_month<s.start_month then raise exception 'El mes es anterior al inicio del registro.'; end if;
 with funds as (select 'general'::text fund,s.opening_general opening union all select 'rent',s.opening_rent), totals as (
 select f.fund, f.opening+coalesce(sum(case when e.entry_date<p_month then case when e.kind='income' then e.amount_cents else -e.amount_cents end else 0 end),0) opening,
 coalesce(sum(case when e.entry_date>=p_month and e.kind='income' then e.amount_cents else 0 end),0) income,
 coalesce(sum(case when e.entry_date>=p_month and e.kind='expense' then e.amount_cents else 0 end),0) expense
 from funds f left join public.treasury_entries e on e.fund=f.fund and e.status='posted' and e.entry_date<(p_month+interval '1 month') group by f.fund,f.opening)
 select jsonb_build_object('configured',true,'month',p_month,'funds',jsonb_agg(jsonb_build_object('fund',fund,'opening',opening,'income',income,'expense',expense,'closing',opening+income-expense))) into result from totals;
 return result || jsonb_build_object(
 'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.entry_date,e.created_at) from public.treasury_entries e where entry_date>=p_month and entry_date<p_month+interval '1 month'),'[]'::jsonb),
 'dues',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'expected',case when m.start_month<=p_month and (m.end_month is null or m.end_month>=p_month) then m.monthly_cents else 0 end,'paid',coalesce((select sum(amount_cents) from public.treasury_entries where member_id=m.id and due_month=p_month and status='posted'),0)) order by m.name) from public.treasury_members m where (m.start_month<=p_month and (m.end_month is null or m.end_month>=p_month)) or exists(select 1 from public.treasury_entries where member_id=m.id and due_month=p_month and status='posted')),'[]'::jsonb),
 'closure',(select to_jsonb(c) from public.treasury_closures c where month=p_month));
end $$;
revoke all on function public.treasury_report(date) from public,anon;
grant execute on function public.treasury_report(date) to authenticated;

-- The definer is internal, uses fully qualified names, checks a live profile, and grants no raw table writes.
create function treasury_private.command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); who public.profiles; s public.treasury_settings; oldrow public.treasury_entries; e public.treasury_entries;
 oldjson jsonb; newjson jsonb; key text; lockmonth date; m date; report jsonb; total bigint; counted bigint; member public.treasury_members;
begin
 select * into who from public.profiles where id=uid and active and role in ('admin','treasurer');
 if uid is null or who.id is null then raise exception 'No tienes permiso para modificar Tesorería.'; end if;
 perform pg_advisory_xact_lock(741902631);
 select * into s from public.treasury_settings;
 select max(month) into lockmonth from public.treasury_closures;
 if p_action='setup' then
  if who.role<>'admin' or s.id is not null then raise exception 'Solo el administrador puede configurar el saldo inicial una vez.'; end if;
  insert into public.treasury_settings(start_month,opening_general,opening_rent,note,created_by) values((p_data->>'start_month')::date,(p_data->>'opening_general')::bigint,(p_data->>'opening_rent')::bigint,trim(p_data->>'note'),uid) returning to_jsonb(treasury_settings.*) into newjson;
  if (newjson->>'start_month')::date>date_trunc('month',timezone('America/Guayaquil',now()))::date then raise exception 'No se puede iniciar en un mes futuro.'; end if;
  key:='settings';
 elsif s.id is null then raise exception 'Primero el administrador debe registrar el saldo inicial verificado.';
 elsif p_action='member' then
  key:=coalesce(nullif(p_data->>'id',''),gen_random_uuid()::text);
  select * into member from public.treasury_members where id=key::uuid;
  oldjson:=case when member.id is null then null else to_jsonb(member) end;
  if member.id is not null and exists(select 1 from public.treasury_entries where member_id=member.id) then
   -- Preserve historical expectations and labels; only end participation in a future open month.
   if p_data->>'name'<>member.name or (p_data->>'start_month')::date<>member.start_month or (p_data->>'monthly_cents')::int<>member.monthly_cents then raise exception 'Este compañero ya tiene movimientos; conserva sus datos históricos.'; end if;
  end if;
  if member.id is not null and lockmonth is not null and member.start_month<=lockmonth and (p_data->>'name' is distinct from member.name or (p_data->>'start_month')::date is distinct from member.start_month or (p_data->>'monthly_cents')::int is distinct from member.monthly_cents or (member.end_month<=lockmonth and nullif(p_data->>'end_month','')::date is distinct from member.end_month)) then raise exception 'No se pueden modificar datos históricos de meses cerrados.'; end if;
  m:=(p_data->>'start_month')::date;
  if member.id is null and lockmonth is not null and m<=lockmonth then raise exception 'No se pueden cambiar aportes de meses cerrados.'; end if;
  if member.id is not null and lockmonth is not null and (p_data->>'end_month' is null or (p_data->>'end_month')::date<lockmonth) then raise exception 'La baja debe conservar los meses cerrados.'; end if;
  insert into public.treasury_members(id,name,start_month,end_month,monthly_cents) values(key::uuid,trim(p_data->>'name'),m,nullif(p_data->>'end_month','')::date,(p_data->>'monthly_cents')::int)
  on conflict(id) do update set name=excluded.name,start_month=excluded.start_month,end_month=excluded.end_month,monthly_cents=excluded.monthly_cents returning to_jsonb(treasury_members.*) into newjson;
 elsif p_action in ('save','void','discard') then
  key:=(p_data->>'id');
  select * into oldrow from public.treasury_entries where id=key::uuid;
  oldjson:=case when oldrow.id is null then null else to_jsonb(oldrow) end;
  if oldrow.id is not null and oldrow.version<>coalesce((p_data->>'version')::int,0) then raise exception 'Otra persona cambió este registro. Recarga antes de continuar.'; end if;
  if oldrow.id is not null and lockmonth is not null and oldrow.entry_date<lockmonth+interval '1 month' then raise exception 'El período está cerrado.'; end if;
  if p_action='discard' then
   if oldrow.id is null or oldrow.status<>'draft' then raise exception 'Solo se pueden descartar borradores.'; end if;
   delete from public.treasury_entries where id=oldrow.id;
  elsif p_action='void' then
   if oldrow.id is null or oldrow.status<>'posted' then raise exception 'Solo se puede anular un movimiento confirmado.'; end if;
   update public.treasury_entries set status='void',void_reason=trim(p_data->>'reason'),updated_by=uid,updated_at=now(),version=version+1 where id=oldrow.id returning to_jsonb(treasury_entries.*) into newjson;
  else
   if oldrow.id is not null and oldrow.status<>'draft' then raise exception 'Los movimientos confirmados no se sobrescriben. Anula y registra la corrección.'; end if;
   e.id:=key::uuid; e.entry_date:=(p_data->>'entry_date')::date; e.status:=coalesce(p_data->>'status','draft');
   if e.status not in ('draft','posted') then raise exception 'Estado inválido.'; end if;
   if e.entry_date<s.start_month or e.entry_date>timezone('America/Guayaquil',now())::date then raise exception 'Fecha fuera del período de registro.'; end if;
   if lockmonth is not null and e.entry_date<lockmonth+interval '1 month' then raise exception 'El período está cerrado.'; end if;
   e.kind:=p_data->>'kind'; e.fund:=p_data->>'fund'; e.category:=p_data->>'category';
   if (e.kind='income')<>(e.category in ('seventh','rent_contribution','other_income')) then raise exception 'Categoría incompatible con el movimiento.'; end if;
   if (e.category='rent_contribution' or e.category='rent') and e.fund<>'rent' then raise exception 'Usa el fondo del local.'; end if;
   if e.category='seventh' and e.fund<>'general' then raise exception 'La séptima tradición pertenece al fondo general.'; end if;
   e.amount_cents:=nullif(p_data->>'amount_cents','')::bigint; e.description:=coalesce(trim(p_data->>'description'),'');
   e.receipt_path:=nullif(p_data->>'receipt_path',''); e.no_receipt_reason:=coalesce(trim(p_data->>'no_receipt_reason'),'');
   if e.receipt_path is not null and not exists(select 1 from storage.objects where bucket_id='treasury-receipts' and name=e.receipt_path and split_part(name,'/',1)=key) then raise exception 'El comprobante no está guardado para este registro.'; end if;
   if oldrow.receipt_path is not null and e.receipt_path is distinct from oldrow.receipt_path then raise exception 'Conserva el comprobante original del borrador.'; end if;
   if e.status='posted' and e.kind='expense' and e.receipt_path is null and length(e.no_receipt_reason)<5 then raise exception 'Adjunta comprobante o explica por qué no existe.'; end if;
   if e.category='rent_contribution' then
    e.member_id:=nullif(p_data->>'member_id','')::uuid; e.due_month:=nullif(p_data->>'due_month','')::date;
    select * into member from public.treasury_members where id=e.member_id;
    if e.status='posted' and (member.id is null or e.due_month is null) then raise exception 'Selecciona el compañero y el mes del aporte.'; end if;
    if e.due_month is not null and lockmonth is not null and e.due_month<=lockmonth then raise exception 'Reabre el período para cambiar aportes de un mes cerrado.'; end if;
    if e.status='posted' and (e.due_month<s.start_month or e.due_month<member.start_month or (member.end_month is not null and e.due_month>member.end_month)) then raise exception 'El mes del aporte está fuera del período del compañero.'; end if;
    e.member_name:=member.name;
   end if;
   insert into public.treasury_entries(id,status,entry_date,kind,fund,category,amount_cents,description,member_id,member_name,due_month,receipt_path,no_receipt_reason,created_by,updated_by,posted_at)
   values(e.id,e.status,e.entry_date,e.kind,e.fund,e.category,e.amount_cents,e.description,e.member_id,e.member_name,e.due_month,e.receipt_path,e.no_receipt_reason,uid,uid,case when e.status='posted' then now() end)
   on conflict(id) do update set status=excluded.status,entry_date=excluded.entry_date,kind=excluded.kind,fund=excluded.fund,category=excluded.category,amount_cents=excluded.amount_cents,description=excluded.description,member_id=excluded.member_id,member_name=excluded.member_name,due_month=excluded.due_month,receipt_path=excluded.receipt_path,no_receipt_reason=excluded.no_receipt_reason,updated_by=uid,updated_at=now(),posted_at=excluded.posted_at,version=public.treasury_entries.version+1 returning to_jsonb(treasury_entries.*) into newjson;
  end if;
 elsif p_action='close' then
  m:=(p_data->>'month')::date; key:=m::text;
  if m<>coalesce((lockmonth+interval '1 month')::date,s.start_month) then raise exception 'Cierra los meses en orden, desde el inicio del registro.'; end if;
  if m>=date_trunc('month',timezone('America/Guayaquil',now()))::date then raise exception 'El mes todavía no ha terminado. Puedes descargar un informe provisional.'; end if;
  if exists(select 1 from public.treasury_entries where status='draft' and entry_date>=m and entry_date<m+interval '1 month') then raise exception 'Completa o descarta los borradores del mes antes de cerrarlo.'; end if;
  report:=public.treasury_report(m);
  select sum((f->>'closing')::bigint) into total from jsonb_array_elements(report->'funds') f;
  counted:=(p_data->>'counted_cents')::bigint;
  if counted<>total and length(trim(coalesce(p_data->>'note','')))<5 then raise exception 'Explica la diferencia entre el saldo calculado y el dinero contado.'; end if;
  insert into public.treasury_closures(month,summary,counted_cents,difference_cents,note,closed_by,closed_name) values(m,report,counted,counted-total,coalesce(p_data->>'note',''),uid,coalesce(who.display_name,'Servidor')) returning to_jsonb(treasury_closures.*) into newjson;
 elsif p_action='reopen' then
  m:=(p_data->>'month')::date; key:=m::text;
  if who.role<>'admin' or m is distinct from lockmonth or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Solo el administrador puede reabrir el último mes cerrado, indicando el motivo.'; end if;
  delete from public.treasury_closures where month=m returning to_jsonb(treasury_closures.*) into oldjson;
  newjson:=jsonb_build_object('reason',p_data->>'reason');
 else raise exception 'Acción desconocida.';
 end if;
 insert into public.treasury_audit(actor,actor_name,action,entity_id,before_data,after_data) values(uid,coalesce(who.display_name,'Servidor'),p_action,key,oldjson,newjson);
 return jsonb_build_object('ok',true,'record',newjson);
end $$;
revoke all on function treasury_private.command(text,jsonb) from public,anon;
grant execute on function treasury_private.command(text,jsonb) to authenticated;
create function public.treasury_command(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select treasury_private.command(p_action,p_data); $$;
revoke all on function public.treasury_command(text,jsonb) from public,anon;
grant execute on function public.treasury_command(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('treasury-receipts','treasury-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy treasury_receipt_read on storage.objects for select to authenticated using(bucket_id='treasury-receipts' and (select public.treasury_access()));
create policy treasury_receipt_insert on storage.objects for insert to authenticated with check(
 bucket_id='treasury-receipts' and exists(select 1 from public.profiles where id=(select auth.uid()) and active and role in ('admin','treasurer'))
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
 and not exists(select 1 from public.treasury_entries e where e.id::text=split_part(name,'/',1) and e.status<>'draft')
);
-- No overwrite/delete policies: original evidence remains available in the audit record.
