begin;
create table public.treasury_dues_reconciliations (
 member_id uuid not null references public.treasury_members(id),
 due_month date not null check (extract(day from due_month)=1),
 recognized_cents integer not null default 0 check (recognized_cents>=0),
 waived_cents integer not null default 0 check (waived_cents>=0),
 reason text not null check(length(btrim(reason))>=10),
 source_entry_id uuid references public.treasury_entries(id),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 primary key(member_id,due_month)
);
alter table public.treasury_dues_reconciliations enable row level security;
revoke all on public.treasury_dues_reconciliations from public,anon,authenticated;
grant select on public.treasury_dues_reconciliations to authenticated;
create policy "Consultar conciliaciones con acceso a tesorería"
on public.treasury_dues_reconciliations for select to authenticated using ((select public.treasury_access()));
CREATE OR REPLACE FUNCTION public.treasury_dues_history(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  s public.treasury_settings;
  through_month date;
  result jsonb;
begin
  if not public.treasury_access() then
    raise exception 'No tienes acceso a Tesorería.';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'Mes inválido.';
  end if;
  select * into s from public.treasury_settings;
  if s.id is null then return jsonb_build_object('configured', false, 'members', '[]'::jsonb); end if;
  if p_month < s.start_month then raise exception 'El mes es anterior al inicio del registro.'; end if;
  through_month := least(p_month, date_trunc('month', timezone('America/Guayaquil', now()))::date);
  with payments as (
    select e.member_id, e.due_month, sum(e.amount_cents)::bigint paid
    from public.treasury_entries e
    where e.status = 'posted' and e.kind = 'income' and e.category = 'rent_contribution'
      and e.entry_date < through_month + interval '1 month'
      and e.due_month <= through_month
    group by e.member_id, e.due_month
  ), periods as (
    select m.id, d.month::date as month, m.monthly_cents::bigint as expected,
      (coalesce(p.paid, 0) + coalesce(r.recognized_cents, 0))::bigint as paid,
      greatest(0, m.monthly_cents - coalesce(p.paid, 0) - coalesce(r.recognized_cents, 0) - coalesce(r.waived_cents, 0))::bigint as pending,
      greatest(0, coalesce(p.paid, 0) + coalesce(r.recognized_cents, 0) - m.monthly_cents)::bigint as credit,
      coalesce(r.recognized_cents, 0) as recognized_paid, coalesce(r.waived_cents, 0) as waived,
      r.reason as reconciliation_note
    from public.treasury_members m
    cross join lateral pg_catalog.generate_series(
      greatest(m.start_month, s.start_month)::timestamp,
      least(coalesce(m.end_month, through_month), through_month)::timestamp,
      interval '1 month'
    ) as d(month)
    left join payments p on p.member_id = m.id and p.due_month = d.month::date
    left join public.treasury_dues_reconciliations r on r.member_id=m.id and r.due_month=d.month::date
  ), accounts as (
    select m.id, m.name, m.start_month, m.end_month, m.monthly_cents,
      sum(p.pending) filter(where p.month < through_month)::bigint as previous_pending,
      coalesce(max(p.expected) filter(where p.month = through_month), 0)::bigint as expected,
      coalesce(max(p.paid) filter(where p.month = through_month), 0)::bigint as paid,
      coalesce(max(p.pending) filter(where p.month = through_month), 0)::bigint as current_pending,
      sum(p.pending)::bigint as total_pending,
      count(*) filter(where p.pending > 0) as months_pending,
      min(p.month) filter(where p.pending > 0) as oldest_pending_month,
      jsonb_agg(jsonb_build_object('month', p.month, 'expected', p.expected,
        'paid', p.paid, 'pending', p.pending, 'credit', p.credit,
        'recognized_paid',p.recognized_paid,'waived',p.waived,'reconciliation_note',p.reconciliation_note) order by p.month) as periods
    from public.treasury_members m join periods p on p.id = m.id
    group by m.id
  )
  select jsonb_build_object('configured', true, 'month', p_month, 'through_month', through_month,
    'members', coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'previous_pending', coalesce(a.previous_pending, 0)) order by a.name, a.id), '[]'::jsonb))
  into result from accounts a;
  return result;
end $function$;

commit;
