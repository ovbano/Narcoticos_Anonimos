-- Integration checks: run as project postgres; all fixtures are rolled back.
begin;
insert into auth.users(id,email) values
 ('9f748e57-a567-45da-b259-fac37a493101','treasury-qa-admin@example.invalid'),
 ('9f748e57-a567-45da-b259-fac37a493102','treasury-qa-server@example.invalid'),
 ('9f748e57-a567-45da-b259-fac37a493103','treasury-qa-auditor@example.invalid'),
 ('9f748e57-a567-45da-b259-fac37a493104','treasury-qa-editor@example.invalid');
insert into public.profiles(id,display_name,role,active) values
 ('9f748e57-a567-45da-b259-fac37a493101','QA Admin','admin',true),
 ('9f748e57-a567-45da-b259-fac37a493102','QA Servicio','treasurer',true),
 ('9f748e57-a567-45da-b259-fac37a493103','QA Revisión','auditor',true),
 ('9f748e57-a567-45da-b259-fac37a493104','QA Editor','editor',true)
 on conflict(id) do update set role=excluded.role,active=true;
insert into storage.objects(bucket_id,name) values('treasury-receipts','9f748e57-a567-45da-b259-fac37a493120/9f748e57-a567-45da-b259-fac37a493199.png');
set local role authenticated;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493101',true);
do $$ begin if exists(select 1 from public.treasury_entries) then raise exception 'Run on an empty treasury test database';end if; perform public.treasury_command(case when exists(select 1 from public.treasury_settings) then 'initial_update' else 'setup' end,'{"start_month":"2026-08-01","opening_general":10000,"opening_rent":1000,"note":"Prueba transaccional; se revierte","reason":"Prueba transaccional"}');end $$;
select public.treasury_command('member','{"id":"9f748e57-a567-45da-b259-fac37a493110","name":"QA Compañero","start_month":"2026-08-01","monthly_cents":1200}');
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493102',true);
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493120","version":0,"status":"draft","entry_date":"2026-08-15","kind":"income","fund":"general","category":"seventh"}');
do $$ begin
 if (public.treasury_report('2026-08-01')->'funds'->0->>'income')::int<>0 then raise exception 'FAIL draft affects balance'; end if;
end $$;
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493120","version":1,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"general","category":"seventh","amount_cents":1234,"description":"Séptima QA"}');
do $$ declare denied boolean:=false; begin
 begin perform public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493120","version":1,"status":"posted"}'); exception when others then denied:=true; end;
 if not denied then raise exception 'FAIL stale/duplicate write accepted'; end if;
 denied:=false;begin update public.treasury_entries set amount_cents=1; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL direct mutation accepted'; end if;
 denied:=false;begin perform public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493121","version":0,"status":"posted","entry_date":"2026-08-15","kind":"expense","fund":"general","category":"supplies","amount_cents":234,"description":"Gasto QA"}');exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL unsubstantiated expense accepted';end if;
end $$;
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493121","version":0,"status":"posted","entry_date":"2026-08-15","kind":"expense","fund":"general","category":"supplies","amount_cents":234,"description":"Gasto QA","no_receipt_reason":"Compra sin recibo; ejemplo de prueba"}');
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493122","version":0,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"rent","category":"rent_contribution","amount_cents":1200,"description":"Aporte QA","member_id":"9f748e57-a567-45da-b259-fac37a493110","due_month":"2026-08-01"}');
do $$ declare r jsonb; total bigint;begin
 r:=public.treasury_report('2026-08-01'); select sum((f->>'closing')::bigint) into total from jsonb_array_elements(r->'funds') f;
 if total<>13200 then raise exception 'FAIL totals: %',total; end if;
 if (r->'dues'->0->>'paid')::int<>1200 then raise exception 'FAIL allocation'; end if;
end $$;
select public.treasury_command('close','{"month":"2026-08-01","counted_cents":13200,"note":"Conteo de prueba"}');
do $$ declare denied boolean:=false; r jsonb;total bigint; begin
 begin perform public.treasury_command('void','{"id":"9f748e57-a567-45da-b259-fac37a493121","version":1,"reason":"Intento de cambio"}');exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL closed month changed';end if;
 r:=public.treasury_report('2026-09-01');select sum((f->>'opening')::bigint) into total from jsonb_array_elements(r->'funds') f;
 if total<>13200 then raise exception 'FAIL balance carryforward';end if;
 if exists(select 1 from public.treasury_audit where actor_name='') then raise exception 'FAIL missing audit identity';end if;
end $$;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493103',true);
do $$ declare denied boolean:=false;begin
 if not public.treasury_access() then raise exception 'FAIL auditor cannot read';end if;
 if not exists(select 1 from storage.objects where bucket_id='treasury-receipts') then raise exception 'FAIL authorized receipt read';end if;
 begin insert into storage.objects(bucket_id,name) values('treasury-receipts','9f748e57-a567-45da-b259-fac37a493120/9f748e57-a567-45da-b259-fac37a493198.png');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL auditor can upload';end if;denied:=false;
 begin perform public.treasury_command('reopen','{"month":"2026-08-01","reason":"Intento de revisión"}');exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL auditor can write';end if;
end $$;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493104',true);
do $$ begin
 if public.treasury_access() or exists(select 1 from public.treasury_entries) or exists(select 1 from public.treasury_audit) or exists(select 1 from storage.objects where bucket_id='treasury-receipts') then raise exception 'FAIL editor can read treasury'; end if;
end $$;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493101',true);
select public.treasury_command('reopen','{"month":"2026-08-01","reason":"Revisión de prueba"}');
select public.treasury_command('void','{"id":"9f748e57-a567-45da-b259-fac37a493121","version":1,"reason":"Corrección de prueba"}');
do $$ declare r jsonb;total bigint;begin
 r:=public.treasury_report('2026-08-01');select sum((f->>'closing')::bigint) into total from jsonb_array_elements(r->'funds') f;
 if total<>13434 then raise exception 'FAIL void balance';end if;
 if not exists(select 1 from public.treasury_audit where action='void' and before_data->>'status'='posted' and after_data->>'status'='void') then raise exception 'FAIL audit';end if;
end $$;
reset role;
update public.profiles set active=false where id='9f748e57-a567-45da-b259-fac37a493102';
set local role authenticated;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493102',true);
do $$ begin if public.treasury_access() then raise exception 'FAIL revoked account retains access'; end if;end $$;
reset role;
set local role anon;
do $$ declare denied boolean:=false;begin
 begin perform * from public.treasury_entries;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL anonymous treasury access';end if;
 if exists(select 1 from storage.objects where bucket_id='treasury-receipts') then raise exception 'FAIL anonymous receipt access';end if;
end $$;
reset role;
insert into public.anniversaries(id,name,recovery_day,recovery_month,recovery_year,public_visible) values('9f748e57-a567-45da-b259-fac37a493130','Compañero QA Buscable',15,8,2010,false);
set local role authenticated;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493101',true);
select public.admin_set_user_access('9f748e57-a567-45da-b259-fac37a493102','treasurer',true);
do $$ begin
 if not exists(select 1 from jsonb_array_elements(public.admin_list_users()) x where x->>'id'='9f748e57-a567-45da-b259-fac37a493102' and (x->'profile'->>'active')::boolean) then raise exception 'FAIL access list/reactivation';end if;
end $$;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493102',true);
do $$ declare denied boolean:=false;begin
 begin perform public.admin_list_users();exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL treasurer lists credentials';end if;
 if not exists(select 1 from jsonb_array_elements(public.treasury_companions()) c where c->>'id'='9f748e57-a567-45da-b259-fac37a493130') then raise exception 'FAIL companion search';end if;
end $$;
select public.treasury_command('correct','{"id":"9f748e57-a567-45da-b259-fac37a493120","version":2,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"general","category":"seventh","amount_cents":1500,"description":"Séptima corregida QA","reason":"Monto mal digitado"}');
do $$ begin
 if not exists(select 1 from public.treasury_audit where action='correct' and (before_data->>'amount_cents')::int=1234 and (after_data->>'amount_cents')::int=1500) then raise exception 'FAIL correction history';end if;
end $$;
insert into storage.objects(bucket_id,name) values('treasury-receipts','9f748e57-a567-45da-b259-fac37a493120/9f748e57-a567-45da-b259-fac37a493198.png');
select public.treasury_command('correct','{"id":"9f748e57-a567-45da-b259-fac37a493120","version":3,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"general","category":"seventh","amount_cents":1500,"description":"Séptima corregida QA","reason":"Adjuntar comprobante correcto","receipt_path":"9f748e57-a567-45da-b259-fac37a493120/9f748e57-a567-45da-b259-fac37a493198.png"}');
do $$ begin
 if not exists(select 1 from storage.objects where name='9f748e57-a567-45da-b259-fac37a493120/9f748e57-a567-45da-b259-fac37a493199.png') then raise exception 'FAIL original evidence lost';end if;
 if not exists(select 1 from public.treasury_audit where action='correct' and after_data->>'receipt_path' like '%198.png') then raise exception 'FAIL replacement audit';end if;
end $$;
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493125","version":0,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"rent","category":"rent_contribution","amount_cents":1200,"description":"Aporte desde registro","source_anniversary_id":"9f748e57-a567-45da-b259-fac37a493130","due_month":"2026-08-01"}');
select public.treasury_command('save','{"id":"9f748e57-a567-45da-b259-fac37a493126","version":0,"status":"posted","entry_date":"2026-08-15","kind":"income","fund":"rent","category":"rent_contribution","amount_cents":600,"description":"Abono desde registro","source_anniversary_id":"9f748e57-a567-45da-b259-fac37a493130","due_month":"2026-08-01"}');
do $$ declare r jsonb;begin
 if (select count(*) from public.treasury_members where source_anniversary_id='9f748e57-a567-45da-b259-fac37a493130')<>1 then raise exception 'FAIL duplicate companion';end if;
 r:=public.treasury_prepare_report('2026-08-01','pdf',true);
 if not exists(select 1 from public.treasury_audit where action='report_prepared' and actor='9f748e57-a567-45da-b259-fac37a493102' and after_data->>'month'='2026-08-01') then raise exception 'FAIL report attribution';end if;
end $$;
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493101',true);
select public.admin_set_user_access('9f748e57-a567-45da-b259-fac37a493102',null,false);
select set_config('request.jwt.claim.sub','9f748e57-a567-45da-b259-fac37a493102',true);
do $$ begin if public.treasury_access() then raise exception 'FAIL deactivation';end if;end $$;
rollback;
