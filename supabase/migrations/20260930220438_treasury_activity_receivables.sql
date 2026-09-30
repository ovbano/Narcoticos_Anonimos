-- Receivables are informational. Only new, posted receipts enter the cash ledger.
create table public.treasury_activity_accounts (
 id uuid primary key default gen_random_uuid(),
 companion_id uuid references public.anniversaries(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 150),
 activity text not null check(length(trim(activity)) between 1 and 180),
 original_cents bigint not null check(original_cents between 0 and 100000000),
 historical_paid_cents bigint not null default 0 check(historical_paid_cents>=0 and historical_paid_cents<=original_cents),
 activity_date date,
 note text not null default '' check(length(note)<=1000),
 import_key text unique,
 version integer not null default 1,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index treasury_activity_companion_idx on public.treasury_activity_accounts(companion_id);
alter table public.treasury_activity_accounts enable row level security;
revoke all on public.treasury_activity_accounts from anon,authenticated;
grant select on public.treasury_activity_accounts to authenticated;
create policy treasury_activity_read on public.treasury_activity_accounts for select to authenticated using ((select public.treasury_access()));
alter table public.treasury_entries add column activity_account_id uuid references public.treasury_activity_accounts(id);
create index treasury_entry_activity_idx on public.treasury_entries(activity_account_id) where activity_account_id is not null;

-- Also protects payments corrected/voided through the existing movement editor.
create function treasury_private.guard_activity_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.treasury_activity_accounts; paid bigint;
begin
 if tg_op='UPDATE' and old.activity_account_id is not null and new.activity_account_id is distinct from old.activity_account_id then raise exception 'No se puede desvincular un pago de actividad. Anula el movimiento si fue un error.'; end if;
 if new.activity_account_id is null then return new; end if;
 perform pg_advisory_xact_lock(741902631);
 if new.kind<>'income' or new.fund<>'general' or new.category<>'other_income' or new.status not in ('posted','void') then raise exception 'El pago de actividad debe permanecer como ingreso del fondo general.'; end if;
 select * into strict a from public.treasury_activity_accounts where id=new.activity_account_id;
 select coalesce(sum(amount_cents),0) into paid from public.treasury_entries where activity_account_id=a.id and status='posted' and id<>new.id;
 if paid+(case when new.status='posted' then new.amount_cents else 0 end)>a.original_cents-a.historical_paid_cents then raise exception 'El pago supera el saldo pendiente de esta actividad.'; end if;
 return new;
end $$;
revoke all on function treasury_private.guard_activity_payment() from public,anon,authenticated;
create trigger treasury_activity_payment_guard before insert or update on public.treasury_entries for each row execute function treasury_private.guard_activity_payment();

create function public.treasury_activities() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('paid_cents',p.paid,'pending_cents',a.original_cents-a.historical_paid_cents-p.paid,'payments',p.payments) order by a.name,a.created_at),'[]'::jsonb)
 from public.treasury_activity_accounts a
 cross join lateral (select coalesce(sum(e.amount_cents) filter(where e.status='posted'),0) paid,coalesce(jsonb_agg(to_jsonb(e) order by e.entry_date desc,e.created_at desc),'[]'::jsonb) payments from public.treasury_entries e where e.activity_account_id=a.id) p;
$$;
revoke all on function public.treasury_activities() from public,anon;
grant execute on function public.treasury_activities() to authenticated;

create function treasury_private.activity_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare who public.profiles; a public.treasury_activity_accounts; before_row jsonb; paid bigint; cid uuid; cname text; eid uuid; e public.treasury_entries; response jsonb; cents bigint;
begin
 select * into who from public.profiles where id=auth.uid() and active and role in ('admin','treasurer');
 if who.id is null then raise exception 'No tienes permiso para modificar Tesorería.'; end if;
 perform pg_advisory_xact_lock(741902631);
 select * into a from public.treasury_activity_accounts where id=(p_data->>'id')::uuid;
 before_row:=case when a.id is null then null else to_jsonb(a) end;
 if p_action='save' then
  if a.id is not null and (a.version is distinct from (p_data->>'version')::int or length(trim(coalesce(p_data->>'reason','')))<5) then raise exception 'Recarga el registro e indica el motivo de la corrección.'; end if;
  cid:=nullif(p_data->>'companion_id','')::uuid;
  if cid is not null then
   select name into cname from public.anniversaries where id=cid;
   if cname is null then raise exception 'El compañero ya no existe en el registro.'; end if;
  elsif a.id is null then raise exception 'Selecciona un compañero del registro del grupo.';
  else cname:=a.name; end if;
  select coalesce(sum(amount_cents),0) into paid from public.treasury_entries where activity_account_id=a.id and status='posted';
  if (p_data->>'original_cents')::bigint-(p_data->>'historical_paid_cents')::bigint<paid then raise exception 'El valor debe cubrir los pagos ya registrados.'; end if;
  if nullif(p_data->>'activity_date','')::date>timezone('America/Guayaquil',now())::date then raise exception 'La fecha de la actividad no puede estar en el futuro.'; end if;
  insert into public.treasury_activity_accounts(id,companion_id,name,activity,original_cents,historical_paid_cents,activity_date,note,created_by,updated_by)
  values((p_data->>'id')::uuid,cid,cname,trim(p_data->>'activity'),(p_data->>'original_cents')::bigint,(p_data->>'historical_paid_cents')::bigint,nullif(p_data->>'activity_date','')::date,coalesce(p_data->>'note',''),who.id,who.id)
  on conflict(id) do update set companion_id=excluded.companion_id,name=excluded.name,activity=excluded.activity,original_cents=excluded.original_cents,historical_paid_cents=excluded.historical_paid_cents,activity_date=excluded.activity_date,note=excluded.note,updated_by=who.id,updated_at=now(),version=public.treasury_activity_accounts.version+1 returning * into a;
 elsif p_action='pay' then
  if a.id is null then raise exception 'La actividad no existe.'; end if;
  eid:=(p_data->>'entry_id')::uuid; cents:=(p_data->>'amount_cents')::bigint;
  select * into e from public.treasury_entries where id=eid;
  if e.id is not null then
   if e.activity_account_id=a.id and e.status='posted' and e.amount_cents=cents and e.entry_date=(p_data->>'entry_date')::date then return jsonb_build_object('ok',true,'record',to_jsonb(e),'repeated',true); end if;
   raise exception 'El identificador del pago ya fue utilizado. Recarga antes de continuar.';
  end if;
  if cents is null or cents<=0 then raise exception 'Ingresa un pago mayor que cero.'; end if;
  response:=treasury_private.command('save',jsonb_build_object('id',eid,'status','posted','entry_date',p_data->>'entry_date','kind','income','fund','general','category','other_income','amount_cents',cents,'description',left('Abono de actividad · '||a.name||' · '||a.activity||case when length(trim(coalesce(p_data->>'note','')))>0 then ' · '||(p_data->>'note') else '' end,500)));
  update public.treasury_entries set activity_account_id=a.id where id=eid returning * into e;
  response:=jsonb_build_object('ok',true,'record',to_jsonb(e));
 else raise exception 'Acción desconocida.'; end if;
 insert into public.treasury_audit(actor,actor_name,action,entity_id,before_data,after_data) values(who.id,coalesce(who.display_name,'Servidor'),'activity_'||p_action,a.id::text,before_row,case when p_action='pay' then to_jsonb(e) else to_jsonb(a)||jsonb_build_object('reason',p_data->>'reason') end);
 return coalesce(response,jsonb_build_object('ok',true,'record',to_jsonb(a)));
end $$;
revoke all on function treasury_private.activity_command(text,jsonb) from public,anon;
grant execute on function treasury_private.activity_command(text,jsonb) to authenticated;
create function public.treasury_activity_command(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select treasury_private.activity_command(p_action,p_data); $$;
revoke all on function public.treasury_activity_command(text,jsonb) from public,anon;
grant execute on function public.treasury_activity_command(text,jsonb) to authenticated;
