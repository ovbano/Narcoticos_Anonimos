alter table public.treasury_members add column source_anniversary_id uuid references public.anniversaries(id) on delete set null;
create unique index treasury_member_source_idx on public.treasury_members(source_anniversary_id) where source_anniversary_id is not null;
-- Allow saving an unchanged active membership while preserving closed periods.
create or replace function treasury_private.command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); who public.profiles; s public.treasury_settings; oldrow public.treasury_entries; e public.treasury_entries;
 oldjson jsonb; newjson jsonb; key text; lockmonth date; m date; report jsonb; total bigint; counted bigint; member public.treasury_members;
begin
 select * into who from public.profiles where id=uid and active and role in ('admin','treasurer');
 if uid is null or who.id is null then raise exception 'No tienes permiso para modificar Tesorería.'; end if;
 perform pg_advisory_xact_lock(741902631);
 select * into s from public.treasury_settings;
 select max(month) into lockmonth from public.treasury_closures;
 if p_action='initial_update' then
  if who.role<>'admin' then raise exception 'Solo el administrador puede corregir los saldos iniciales.'; end if;
  if s.id is null or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Indica el motivo de la corrección.'; end if;
  oldjson:=to_jsonb(s) || jsonb_build_object('closures',coalesce((select jsonb_agg(to_jsonb(c)) from public.treasury_closures c),'[]'::jsonb));
  if exists(select 1 from public.treasury_entries where entry_date<(p_data->>'start_month')::date) then raise exception 'El inicio debe incluir todos los movimientos existentes.'; end if;
  update public.treasury_settings set start_month=(p_data->>'start_month')::date,opening_general=(p_data->>'opening_general')::bigint,opening_rent=(p_data->>'opening_rent')::bigint,note=trim(p_data->>'note') returning to_jsonb(treasury_settings.*) into newjson;
  if (newjson->>'start_month')::date>date_trunc('month',timezone('America/Guayaquil',now()))::date then raise exception 'El inicio no puede estar en el futuro.'; end if;
  delete from public.treasury_closures;
  newjson:=newjson || jsonb_build_object('reason',p_data->>'reason','reopened_all',true);key:='settings';
 elsif p_action='setup' then
  if who.role<>'admin' or s.id is not null then raise exception 'Solo el administrador puede configurar el saldo inicial una vez.'; end if;
  insert into public.treasury_settings(start_month,opening_general,opening_rent,note,created_by) values((p_data->>'start_month')::date,(p_data->>'opening_general')::bigint,(p_data->>'opening_rent')::bigint,trim(p_data->>'note'),uid) returning to_jsonb(treasury_settings.*) into newjson;
  if (newjson->>'start_month')::date>date_trunc('month',timezone('America/Guayaquil',now()))::date then raise exception 'No se puede iniciar en un mes futuro.'; end if;
  key:='settings';
 elsif s.id is null then raise exception 'Primero el administrador debe registrar el saldo inicial verificado.';
 elsif p_action='member' then
  key:=coalesce(nullif(p_data->>'id',''),gen_random_uuid()::text);
  select * into member from public.treasury_members where id=key::uuid;
  oldjson:=case when member.id is null then null else to_jsonb(member) end;
  if member.id is not null and lockmonth is not null and member.start_month<=lockmonth and (p_data->>'name' is distinct from member.name or (p_data->>'start_month')::date is distinct from member.start_month or (p_data->>'monthly_cents')::int is distinct from member.monthly_cents or (member.end_month<=lockmonth and nullif(p_data->>'end_month','')::date is distinct from member.end_month)) then raise exception 'No se pueden modificar datos históricos de meses cerrados.'; end if;
  m:=(p_data->>'start_month')::date;
  if member.id is null and lockmonth is not null and m<=lockmonth then raise exception 'No se pueden cambiar aportes de meses cerrados.'; end if;
  if member.id is not null and lockmonth is not null and (nullif(p_data->>'end_month','')::date<lockmonth and nullif(p_data->>'end_month','')::date is distinct from member.end_month) then raise exception 'La baja debe conservar los meses cerrados.'; end if;
  if nullif(p_data->>'source_anniversary_id','') is not null then
   if not exists(select 1 from public.anniversaries where id=(p_data->>'source_anniversary_id')::uuid) then raise exception 'El compañero seleccionado ya no existe en el registro del grupo.'; end if;
   if exists(select 1 from public.treasury_members where source_anniversary_id=(p_data->>'source_anniversary_id')::uuid and id<>key::uuid) then raise exception 'Este compañero ya está registrado en los aportes del local.'; end if;
  end if;
  insert into public.treasury_members(id,name,start_month,end_month,monthly_cents,source_anniversary_id) values(key::uuid,trim(p_data->>'name'),m,nullif(p_data->>'end_month','')::date,(p_data->>'monthly_cents')::int,nullif(p_data->>'source_anniversary_id','')::uuid)
  on conflict(id) do update set name=excluded.name,start_month=excluded.start_month,end_month=excluded.end_month,monthly_cents=excluded.monthly_cents,source_anniversary_id=coalesce(excluded.source_anniversary_id,public.treasury_members.source_anniversary_id) returning to_jsonb(treasury_members.*) into newjson;
 elsif p_action in ('save','correct','void','discard') then
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
   if p_action='correct' then
    if oldrow.id is null or oldrow.status<>'posted' or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Selecciona un movimiento confirmado e indica el motivo de la corrección.'; end if;
    if p_data->>'status'<>'posted' then raise exception 'La corrección debe quedar confirmada.'; end if;
   elsif oldrow.id is not null and oldrow.status<>'draft' then raise exception 'Usa Corregir datos para modificar un movimiento confirmado.'; end if;
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
    if e.member_id is null and nullif(p_data->>'source_anniversary_id','') is not null then
     select * into member from public.treasury_members where source_anniversary_id=(p_data->>'source_anniversary_id')::uuid;
     if member.id is null then
      if e.due_month is null or e.due_month<s.start_month or (lockmonth is not null and e.due_month<=lockmonth) then raise exception 'Selecciona un mes abierto para el aporte.';end if;
      insert into public.treasury_members(name,start_month,monthly_cents,source_anniversary_id) select a.name,e.due_month,1200,a.id from public.anniversaries a where a.id=(p_data->>'source_anniversary_id')::uuid returning * into member;
      if member.id is null then raise exception 'El compañero seleccionado no existe.';end if;
      insert into public.treasury_audit(actor,actor_name,action,entity_id,after_data) values(uid,coalesce(who.display_name,'Servidor'),'member',member.id::text,to_jsonb(member));
     end if;
     e.member_id:=member.id;
    end if;
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
  if p_action='correct' then newjson:=newjson || jsonb_build_object('reason',p_data->>'reason');end if;
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
  if who.role<>'admin' or not exists(select 1 from public.treasury_closures where month=m) or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Solo el administrador puede reabrir meses cerrados, indicando el motivo.'; end if;
  select jsonb_build_object('closures',jsonb_agg(to_jsonb(c))) into oldjson from public.treasury_closures c where month>=m;
  delete from public.treasury_closures where month>=m;
  newjson:=jsonb_build_object('reason',p_data->>'reason');
 else raise exception 'Acción desconocida.';
 end if;
 insert into public.treasury_audit(actor,actor_name,action,entity_id,before_data,after_data) values(uid,coalesce(who.display_name,'Servidor'),p_action,key,oldjson,newjson);
 return jsonb_build_object('ok',true,'record',newjson);
end $$;

-- All privileged reads are internal, with live role checks; wrappers are invokers.
create function treasury_private.admin_users() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise exception 'Solo el administrador puede consultar los accesos.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'createdAt',u.created_at,'lastSignInAt',u.last_sign_in_at,'profile',to_jsonb(p)) order by u.created_at) from auth.users u left join public.profiles p on p.id=u.id),'[]'::jsonb);
end $$;
create function public.admin_list_users() returns jsonb language sql security invoker set search_path='' as $$ select treasury_private.admin_users(); $$;

create function treasury_private.set_access(p_user_id uuid,p_role text,p_active boolean,p_name text default null) returns void language plpgsql security definer set search_path='' as $$
declare who public.profiles; oldp public.profiles; newp public.profiles; begin
 select * into who from public.profiles where id=auth.uid() and active and role='admin';
 if who.id is null then raise exception 'Solo el administrador puede gestionar accesos.';end if;
 perform pg_advisory_xact_lock(741902631);
 if p_role is not null and p_role not in ('admin','editor','treasurer','auditor') then raise exception 'Permiso inválido.';end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'La cuenta no existe.';end if;
 select * into oldp from public.profiles where id=p_user_id;
 if p_user_id=who.id and (p_active=false or (p_role is not null and p_role<>'admin')) then raise exception 'Conserva tu acceso de administrador para evitar dejar el grupo sin control.';end if;
 insert into public.profiles(id,display_name,role,active) values(p_user_id,coalesce(nullif(trim(p_name),''),oldp.display_name,'Servidor'),coalesce(p_role,oldp.role,'treasurer'),coalesce(p_active,oldp.active,false))
 on conflict(id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,updated_at=now() returning * into newp;
 insert into public.treasury_audit(actor,actor_name,action,entity_id,before_data,after_data) values(who.id,coalesce(who.display_name,'Administrador'),'access_update',p_user_id::text,case when oldp.id is null then null else to_jsonb(oldp) end,to_jsonb(newp));
end $$;
create function public.admin_set_user_access(p_user_id uuid,p_role text default null,p_active boolean default null) returns void language sql security invoker set search_path='' as $$ select treasury_private.set_access(p_user_id,p_role,p_active,null); $$;
create function public.admin_enroll_user(p_user_id uuid,p_name text,p_role text) returns void language sql security invoker set search_path='' as $$ select treasury_private.set_access(p_user_id,p_role,true,p_name); $$;

create function treasury_private.companions() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.treasury_access() then raise exception 'Se requiere acceso a Tesorería.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name) order by a.name) from public.anniversaries a),'[]'::jsonb);
end $$;
create function public.treasury_companions() returns jsonb language sql security invoker set search_path='' as $$ select treasury_private.companions(); $$;

create function treasury_private.prepare_report(p_month date,p_format text,p_include_dues boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; who public.profiles;begin
 select * into who from public.profiles where id=auth.uid() and active and role in ('admin','treasurer','auditor');
 if who.id is null then raise exception 'Se requiere acceso a Tesorería.';end if;
 if p_format not in ('pdf','print') then raise exception 'Formato inválido.';end if;
 perform pg_advisory_xact_lock(741902631);
 r:=public.treasury_report(p_month);
 if not coalesce((r->>'configured')::boolean,false) then raise exception 'Primero registra los saldos iniciales.';end if;
 insert into public.treasury_audit(actor,actor_name,action,entity_id,after_data) values(who.id,coalesce(who.display_name,'Servidor'),'report_prepared',p_month::text,jsonb_build_object('month',p_month,'format',p_format,'include_dues',p_include_dues,'funds',r->'funds','closed',r->'closure' is not null and r->'closure'<>'null'::jsonb));
 return r;
end $$;
create function public.treasury_prepare_report(p_month date,p_format text,p_include_dues boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select treasury_private.prepare_report(p_month,p_format,p_include_dues); $$;

do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace in ('treasury_private'::regnamespace,'public'::regnamespace) and proname in ('admin_users','admin_list_users','set_access','admin_set_user_access','admin_enroll_user','companions','treasury_companions','prepare_report','treasury_prepare_report') loop
 execute format('revoke all on function %s from public,anon',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
