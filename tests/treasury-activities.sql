-- Transactional regression: synthetic rows only, every change rolled back.
-- Run as database owner against a configured project with an active admin.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where active and role='admin' limit 1),true);
do $$
declare aid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); cid uuid; r jsonb; n bigint; total_before bigint; fail boolean;
begin
 select id into strict cid from public.anniversaries limit 1;
 select coalesce(sum(case when kind='income' then amount_cents else -amount_cents end),0) into total_before from public.treasury_entries where status='posted';
 perform public.treasury_activity_command('save',jsonb_build_object('id',aid,'companion_id',cid,'activity','QA synthetic activity','original_cents',1000,'historical_paid_cents',200));
 if (select coalesce(sum(case when kind='income' then amount_cents else -amount_cents end),0) from public.treasury_entries where status='posted')<>total_before then raise exception 'Historical balance changed cash';end if;
 r:=jsonb_build_object('id',aid,'entry_id',eid,'amount_cents',300,'entry_date',timezone('America/Guayaquil',now())::date);
 perform public.treasury_activity_command('pay',r);
 perform public.treasury_activity_command('pay',r);
 if (select count(*) from public.treasury_entries where activity_account_id=aid)<>1 then raise exception 'Duplicate payment';end if;
 if (select coalesce(sum(case when kind='income' then amount_cents else -amount_cents end),0) from public.treasury_entries where status='posted')<>total_before+300 then raise exception 'Cash incorrect';end if;
 fail:=false;begin perform public.treasury_activity_command('pay',r||jsonb_build_object('entry_id',gen_random_uuid(),'amount_cents',501));exception when others then if sqlerrm like '%supera el saldo%' then fail:=true;else raise;end if;end;if not fail then raise exception 'Overpayment accepted';end if;
 r:=(select to_jsonb(e) from public.treasury_entries e where id=eid)||jsonb_build_object('amount_cents',400,'reason','QA correction');
 perform public.treasury_command('correct',r);
 select (x->>'pending_cents')::bigint into n from jsonb_array_elements(public.treasury_activities()) x where x->>'id'=aid::text;
 if n<>400 then raise exception 'Correction did not recalculate pending';end if;
 fail:=false;begin perform public.treasury_command('correct',r||jsonb_build_object('version',2,'fund','rent'));exception when others then if sqlerrm like '%fondo general%' then fail:=true;else raise;end if;end;if not fail then raise exception 'Fund change accepted';end if;
 perform public.treasury_command('void',jsonb_build_object('id',eid,'version',2,'reason','QA void payment'));
 select (x->>'pending_cents')::bigint into n from jsonb_array_elements(public.treasury_activities()) x where x->>'id'=aid::text;
 if n<>800 then raise exception 'Void did not restore pending';end if;
 perform public.treasury_activity_command('pay',jsonb_build_object('id',aid,'entry_id',gen_random_uuid(),'amount_cents',800,'entry_date',timezone('America/Guayaquil',now())::date));
 select (x->>'pending_cents')::bigint into n from jsonb_array_elements(public.treasury_activities()) x where x->>'id'=aid::text;
 if n<>0 then raise exception 'Full payment not settled';end if;
 -- Rejected correction must not modify cash or receivable.
 fail:=false;begin perform public.treasury_activity_command('save',jsonb_build_object('id',aid,'version',1,'companion_id',cid,'activity','QA synthetic activity','original_cents',500,'historical_paid_cents',200,'reason','QA invalid correction'));exception when others then if sqlerrm like '%cubrir los pagos%' then fail:=true;else raise;end if;end;if not fail then raise exception 'Invalid account correction accepted';end if;
 raise notice 'PASS: historical separation, partial/full payments, duplicate retry, overpayment, correction, fund guard, void and account guard';
end $$;
-- An authenticated auditor can read, but cannot mutate.
update public.profiles set role='auditor' where id=auth.uid();
set local role authenticated;
select jsonb_typeof(public.treasury_activities()) as auditor_read;
do $$ begin
 begin perform public.treasury_activity_command('save','{}');raise exception 'Auditor mutation accepted';exception when others then if sqlerrm not like '%No tienes permiso%' then raise;end if;end;
end $$;
reset role;
update public.profiles set active=false where id=auth.uid();
set local role authenticated;
do $$ begin if public.treasury_activities()<>'[]'::jsonb then raise exception 'Inactive user can read';end if;end $$;
reset role;
select not has_function_privilege('anon','public.treasury_activities()','execute') as anon_blocked,
 not has_table_privilege('authenticated','public.treasury_activity_accounts','insert,update,delete') as direct_writes_blocked;
rollback;
