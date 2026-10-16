// Isolated PostgreSQL integration: never connects to production.
// npm install --no-save @electric-sql/pglite
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table public.profiles(id uuid primary key,role text constraint profiles_role_check check(role in ('admin','editor')),active boolean,display_name text);
    create table public.anniversaries(id uuid primary key,name text);
    create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    grant select on public.profiles to authenticated;
  `);
  const initial=fs.readFileSync(path.join(root,'supabase/migrations/20260926231717_treasury_private_ledger.sql'),'utf8');
  await db.exec(initial);
  await db.exec('alter table public.treasury_members add column source_anniversary_id uuid;');
  const migration=fs.readdirSync(path.join(root,'supabase/migrations')).find(f=>f.endsWith('_treasury_accumulated_rent_dues.sql'));
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',migration),'utf8'));
  const [{rows:dates}]=await db.exec(`select date_trunc('month',timezone('America/Guayaquil',now()))::date::text as current_month,
    (date_trunc('month',timezone('America/Guayaquil',now()))-interval '1 month')::date::text as previous,
    (date_trunc('month',timezone('America/Guayaquil',now()))-interval '2 months')::date::text as first;`);
  const d=dates[0], uid='00000000-0000-4000-8000-000000000001';
  await db.query('insert into public.profiles values($1,$2,true,$3)',[uid,'admin','QA']);
  await db.query('insert into public.treasury_settings(start_month,opening_general,opening_rent,note,created_by) values($1,10000,0,$2,$3)',[d.first,'Isolated QA',uid]);
  const a='00000000-0000-4000-8000-000000000002', b='00000000-0000-4000-8000-000000000003', c='00000000-0000-4000-8000-000000000004';
  await db.query('insert into public.treasury_members(id,name,start_month,monthly_cents) values($1,$2,$3,1200),($4,$5,$3,1200),($6,$7,$3,1200)',[a,'Compañero A',d.first,b,'Compañero B',c,'Compañero C']);
  await db.query('update public.treasury_members set end_month=$1 where id=$2',[d.previous,b]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  async function command(action,data){return (await db.query('select public.treasury_command($1,$2::jsonb) as result',[action,JSON.stringify(data)])).rows[0].result;}
  async function ledger(month){return (await db.query('select public.treasury_dues_history($1::date) as result',[month])).rows[0].result;}
  async function payment(member,month,date,value){return command('save',{id:crypto.randomUUID(),status:'posted',version:0,entry_date:date,kind:'income',fund:'rent',category:'rent_contribution',amount_cents:value,description:'Aporte de prueba',member_id:member,due_month:month});}
  await payment(a,d.first,d.first,1200);
  await payment(a,d.previous,d.previous,600);
  await payment(c,d.first,d.first,2400); // Extra in one month does not erase another month's debt.
  let r=await ledger(d.current_month), person=r.members.find(m=>m.id===a);
  assert.equal(person.previous_pending,600);assert.equal(person.current_pending,1200);assert.equal(person.total_pending,1800);
  assert.equal(r.members.find(m=>m.id===b).total_pending,2400);assert.equal(r.members.find(m=>m.id===b).current_pending,0);
  assert.equal(r.members.find(m=>m.id===c).total_pending,2400);
  const historical=await ledger(d.previous);
  assert.equal(historical.members.find(m=>m.id===a).total_pending,600);
  await db.exec('reset role');
  await db.query("insert into public.treasury_closures(month,summary,counted_cents,difference_cents,note,closed_by,closed_name) values($1,public.treasury_report($1),14200,0,'QA',$2,'QA')",[d.previous,uid]);
  const snapshot=(await db.query('select summary from public.treasury_closures')).rows[0].summary;
  await db.exec('set role authenticated');
  await payment(a,d.previous,d.current_month,600);
  r=await ledger(d.current_month);assert.equal(r.members.find(m=>m.id===a).total_pending,1200);
  assert.equal((await ledger(d.previous)).members.find(m=>m.id===a).total_pending,600,'late payment must not rewrite a historical as-of view');
  await assert.rejects(payment(a,d.previous,d.previous,100),/cerrado/i,'closed cash period still rejects changes');
  await command('save',{id:crypto.randomUUID(),status:'draft',version:0,entry_date:d.current_month,kind:'income',fund:'rent',category:'rent_contribution',amount_cents:600,description:'Borrador de prueba',member_id:a,due_month:d.current_month});
  assert.equal((await ledger(d.current_month)).members.find(m=>m.id===a).total_pending,1200,'drafts never pay debts');
  const collected=await payment(a,d.current_month,d.current_month,1200);
  assert.equal((await ledger(d.current_month)).members.find(m=>m.id===a).total_pending,0);
  await command('void',{id:collected.record.id,version:collected.record.version,reason:'Anulación de prueba'});
  assert.equal((await ledger(d.current_month)).members.find(m=>m.id===a).total_pending,1200,'voiding a payment restores the debt');
  const cash=(await db.query('select public.treasury_report($1) as result',[d.current_month])).rows[0].result;
  assert.equal(cash.funds.find(f=>f.fund==='rent').income,600);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select summary from public.treasury_closures')).rows[0].summary,snapshot);
  await db.query("update public.profiles set role='auditor' where id=$1",[uid]);await db.exec('set role authenticated');
  assert.ok((await ledger(d.current_month)).configured);
  await assert.rejects(payment(a,d.current_month,d.current_month,100),/permiso/i);
  await db.exec('reset role');await db.query('update public.profiles set active=false where id=$1',[uid]);await db.exec('set role authenticated');
  await assert.rejects(ledger(d.current_month),/acceso/i);
  await db.exec('reset role; set role anon');await assert.rejects(ledger(d.current_month),/permission denied/i);
  await db.exec('reset role');
  await db.query('update public.profiles set active=true where id=$1',[uid]);await db.exec('set role authenticated');
  await assert.rejects(ledger(d.current_month.slice(0,7)+'-02'),/inválido/i);
  assert.equal((await ledger('2030-01-01')).through_month,d.current_month,'no debt for future months');
  await db.close();
  console.log('PASS: accumulated/partial arrears, ended participation, no cross-month credits, historical cutoff, late collection, cash/closure preservation, auditor/inactive/anon permissions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
