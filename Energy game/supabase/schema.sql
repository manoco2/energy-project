-- Energijos vartojimo sąmoningumo testo duomenų bazė.
-- Paleiskite visą failą Supabase Dashboard → SQL Editor.

create table if not exists public.workshop_submissions (
  id uuid primary key default gen_random_uuid(),
  workshop_id text not null,
  session_id uuid not null,
  self_rating smallint not null check (self_rating between 1 and 10),
  profile jsonb not null,
  answers jsonb not null,
  total_score numeric(5,2) not null check (total_score between 0 and 100),
  electricity_awareness_score numeric(5,2) not null check (electricity_awareness_score between 0 and 100),
  electricity_management_score numeric(5,2) not null check (electricity_management_score between 0 and 100),
  heating_score numeric(5,2) check (heating_score between 0 and 100),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_submissions_workshop_session_unique unique (workshop_id, session_id),
  constraint workshop_id_format check (workshop_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  constraint profile_is_object check (jsonb_typeof(profile) = 'object'),
  constraint answers_is_object check (jsonb_typeof(answers) = 'object')
);

create index if not exists workshop_submissions_workshop_idx
  on public.workshop_submissions (workshop_id, completed_at desc);

alter table public.workshop_submissions enable row level security;
revoke all on table public.workshop_submissions from public, anon, authenticated;

drop function if exists public.submit_assessment(text, uuid, smallint, jsonb, jsonb);

create function public.submit_assessment(
  p_workshop_id text,
  p_session_id uuid,
  p_self_rating smallint,
  p_profile jsonb,
  p_answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text[] := array['E1','E2','E3','E4','E5','E6','E7','E8','E9'];
  v_area numeric;
  v_people integer;
  v_monthly_kwh numeric;
  v_total_valid integer;
  v_total_points numeric;
  v_awareness_valid integer;
  v_awareness_points numeric;
  v_management_valid integer;
  v_management_points numeric;
  v_heating_valid integer;
  v_heating_points numeric;
  v_total_score numeric;
  v_awareness_score numeric;
  v_management_score numeric;
  v_heating_score numeric;
begin
  if p_workshop_id is null or p_workshop_id !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then
    raise exception 'Netinkamas renginio identifikatorius';
  end if;
  if p_session_id is null then raise exception 'Nenurodyta anoniminė sesija'; end if;
  if p_self_rating not between 1 and 10 then raise exception 'Savęs vertinimas turi būti nuo 1 iki 10'; end if;
  if jsonb_typeof(p_profile) <> 'object' then raise exception 'Netinkamas situacijos atsakymų formatas'; end if;
  if not (p_profile ?& array['S1','S2','S3','S4','S5','S6','S7','S8']) then raise exception 'Trūksta situacijos atsakymų'; end if;
  if p_profile->>'S1' not in ('apartment','house','cottage') then raise exception 'Netinkamas būsto tipas'; end if;
  if p_profile->>'S2' not in ('district','individual','local','unknown') then raise exception 'Netinkamas šildymo būdas'; end if;
  if p_profile->>'S3' not in ('yes','no','unknown') then raise exception 'Netinkamas temperatūros reguliavimo atsakymas'; end if;
  if p_profile->>'S6' not in ('yes','no','unknown') then raise exception 'Netinkamas elektrinio šildymo atsakymas'; end if;
  if p_profile->>'S8' not in ('self','another','varies') then raise exception 'Netinkamas sąskaitų tvarkymo atsakymas'; end if;

  begin
    v_area := (p_profile->>'S4')::numeric;
    v_people := (p_profile->>'S5')::integer;
    if p_profile->>'S7' is not null then v_monthly_kwh := (p_profile->>'S7')::numeric; end if;
  exception when others then
    raise exception 'Netinkamos skaitinės situacijos reikšmės';
  end;
  if v_area < 10 or v_area > 1000 then raise exception 'Būsto plotas turi būti nuo 10 iki 1000 m²'; end if;
  if v_people < 1 or v_people > 20 then raise exception 'Gyventojų skaičius turi būti nuo 1 iki 20'; end if;
  if v_monthly_kwh is not null and (v_monthly_kwh < 1 or v_monthly_kwh > 100000) then raise exception 'Elektros suvartojimo reikšmė netinkama'; end if;

  if p_profile->>'S2' <> 'unknown' then
    v_expected := array_append(v_expected, 'H1');
    if p_profile->>'S3' = 'yes' then v_expected := v_expected || array['H2','H3','H4']; end if;
    if p_profile->>'S2' = 'individual' then v_expected := array_append(v_expected, 'H5'); end if;
    if p_profile->>'S1' = 'apartment' and p_profile->>'S2' in ('district','local') then
      v_expected := v_expected || array['H6','H7','H8','H9'];
    end if;
  end if;

  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Netinkamas testo atsakymų formatas'; end if;
  if (select count(*) from jsonb_object_keys(p_answers)) <> coalesce(array_length(v_expected, 1), 0) then
    raise exception 'Pateiktas netinkamas klausimų skaičius';
  end if;
  if exists (select 1 from unnest(v_expected) code where not (p_answers ? code)) then raise exception 'Trūksta taikomo klausimo atsakymo'; end if;
  if exists (select 1 from jsonb_object_keys(p_answers) code where not code = any(v_expected)) then raise exception 'Pateiktas netaikomas klausimas'; end if;
  if exists (
    select 1 from jsonb_each(p_answers)
    where jsonb_typeof(value) not in ('number','null')
       or (jsonb_typeof(value) = 'number' and (value #>> '{}') !~ '^[012]$')
       or (jsonb_typeof(value) = 'null' and key not in ('E3','E9'))
  ) then raise exception 'Atsakymų reikšmės turi būti 0, 1, 2 arba leidžiama Netaikoma'; end if;

  select count(*), coalesce(sum((value #>> '{}')::numeric), 0)
    into v_total_valid, v_total_points
  from jsonb_each(p_answers) where jsonb_typeof(value) = 'number';

  select count(*), coalesce(sum((value #>> '{}')::numeric), 0)
    into v_awareness_valid, v_awareness_points
  from jsonb_each(p_answers)
  where key = any(array['E1','E2','E3','E4','E5']) and jsonb_typeof(value) = 'number';

  select count(*), coalesce(sum((value #>> '{}')::numeric), 0)
    into v_management_valid, v_management_points
  from jsonb_each(p_answers)
  where key = any(array['E6','E7','E8','E9']) and jsonb_typeof(value) = 'number';

  select count(*), coalesce(sum((value #>> '{}')::numeric), 0)
    into v_heating_valid, v_heating_points
  from jsonb_each(p_answers)
  where key like 'H%' and jsonb_typeof(value) = 'number';

  v_total_score := round(v_total_points / (2.0 * v_total_valid) * 100, 0);
  v_awareness_score := round(v_awareness_points / (2.0 * v_awareness_valid) * 100, 0);
  v_management_score := round(v_management_points / (2.0 * v_management_valid) * 100, 0);
  v_heating_score := case when v_heating_valid > 0 then round(v_heating_points / (2.0 * v_heating_valid) * 100, 0) else null end;

  insert into public.workshop_submissions (
    workshop_id, session_id, self_rating, profile, answers,
    total_score, electricity_awareness_score, electricity_management_score, heating_score,
    completed_at, updated_at
  ) values (
    p_workshop_id, p_session_id, p_self_rating, p_profile, p_answers,
    v_total_score, v_awareness_score, v_management_score, v_heating_score,
    now(), now()
  )
  on conflict (workshop_id, session_id) do update set
    self_rating = excluded.self_rating,
    profile = excluded.profile,
    answers = excluded.answers,
    total_score = excluded.total_score,
    electricity_awareness_score = excluded.electricity_awareness_score,
    electricity_management_score = excluded.electricity_management_score,
    heating_score = excluded.heating_score,
    completed_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'total_score', v_total_score,
    'electricity_awareness_score', v_awareness_score,
    'electricity_management_score', v_management_score,
    'heating_score', v_heating_score
  );
end;
$$;

drop function if exists public.get_group_summary(text);

create function public.get_group_summary(p_workshop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_average numeric;
  v_lowest jsonb;
begin
  select count(*) into v_count from public.workshop_submissions where workshop_id = p_workshop_id;
  if v_count < 5 then
    return jsonb_build_object('completed_count', v_count, 'unlocked', false, 'overall_average', null, 'lowest_questions', '[]'::jsonb);
  end if;

  select round(avg(total_score), 0) into v_average
  from public.workshop_submissions where workshop_id = p_workshop_id;

  with question_scores as (
    select
      answer.key as question_code,
      count(*) as valid_n,
      round(sum((answer.value #>> '{}')::numeric) / (2.0 * count(*)) * 100, 0) as score
    from public.workshop_submissions submission
    cross join lateral jsonb_each(submission.answers) answer
    where submission.workshop_id = p_workshop_id and jsonb_typeof(answer.value) = 'number'
    group by answer.key
    having count(*) >= 5
    order by score asc, valid_n desc, question_code asc
    limit 3
  )
  select coalesce(jsonb_agg(jsonb_build_object('question_code', question_code, 'score', score, 'valid_n', valid_n) order by score, question_code), '[]'::jsonb)
    into v_lowest from question_scores;

  return jsonb_build_object('completed_count', v_count, 'unlocked', true, 'overall_average', v_average, 'lowest_questions', v_lowest);
end;
$$;

drop function if exists public.get_score_percentile(text, numeric);
drop function if exists public.get_score_percentile(text, numeric, uuid);

create function public.get_score_percentile(p_workshop_id text, p_score numeric, p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_average numeric;
  v_percentile numeric;
  v_consumption_count integer;
  v_other_per_square_metre numeric;
  v_other_per_household_member numeric;
begin
  if p_session_id is null then raise exception 'Nenurodyta anoniminė sesija'; end if;
  select count(*) into v_count from public.workshop_submissions where workshop_id = p_workshop_id;
  if v_count < 5 then return jsonb_build_object('completed_count', v_count, 'unlocked', false); end if;

  select round(avg(total_score), 0), round((count(*) filter (where total_score < p_score))::numeric / v_count * 100, 0)
    into v_average, v_percentile
  from public.workshop_submissions where workshop_id = p_workshop_id;

  select
    count(*),
    round(avg((profile->>'S7')::numeric / nullif((profile->>'S4')::numeric, 0)), 2),
    round(avg((profile->>'S7')::numeric / nullif((profile->>'S5')::numeric, 0)), 2)
  into v_consumption_count, v_other_per_square_metre, v_other_per_household_member
  from public.workshop_submissions
  where workshop_id = p_workshop_id
    and session_id <> p_session_id
    and jsonb_typeof(profile->'S7') = 'number';

  if v_consumption_count < 4 then
    v_other_per_square_metre := null;
    v_other_per_household_member := null;
  end if;

  return jsonb_build_object(
    'completed_count', v_count,
    'unlocked', true,
    'group_average', v_average,
    'percentile', v_percentile,
    'consumption_comparison_count', v_consumption_count,
    'other_per_square_metre', v_other_per_square_metre,
    'other_per_household_member', v_other_per_household_member
  );
end;
$$;

revoke all on function public.submit_assessment(text, uuid, smallint, jsonb, jsonb) from public;
revoke all on function public.get_group_summary(text) from public;
revoke all on function public.get_score_percentile(text, numeric, uuid) from public;

grant execute on function public.submit_assessment(text, uuid, smallint, jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_group_summary(text) to anon, authenticated;
grant execute on function public.get_score_percentile(text, numeric, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
