-- Skeelo Evolution — suporte ao app mobile (itens 1 e 2 do MVP)
--
-- O app mobile (pasta skeelo-evolution-mobile, repo separado) usa este
-- MESMO projeto Supabase — mesma tabela public.profiles, mesmos
-- usuários reais. Este é o registro canônico dessa mudança de schema;
-- há uma cópia de referência no repo do app mobile.
--
-- Só ADICIONA colunas novas e nullable em public.profiles (não quebra
-- nada do PWA, que ignora colunas que não conhece) e cria a tabela
-- nova public.daily_logs.

alter table public.profiles
  add column if not exists age smallint check (age is null or (age > 0 and age < 130)),
  add column if not exists biological_sex text check (biological_sex is null or biological_sex in ('male', 'female')),
  add column if not exists height_cm numeric check (height_cm is null or (height_cm > 0 and height_cm < 300)),
  add column if not exists weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg < 500));

-- Hábitos diários: uma linha por usuário por dia
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  sleep_time time,
  strength_training boolean not null default false,
  strength_training_minutes smallint check (strength_training_minutes is null or strength_training_minutes >= 0),
  cardio_steps integer check (cardio_steps is null or cardio_steps >= 0),
  protein_level smallint check (protein_level is null or protein_level between 0 and 3),
  alcohol_units smallint not null default 0 check (alcohol_units >= 0),
  nicotine boolean not null default false,
  hydration_level smallint check (hydration_level is null or hydration_level between 0 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.daily_logs enable row level security;

create policy "daily_logs_select_own" on public.daily_logs
  for select using (auth.uid() = user_id);

create policy "daily_logs_insert_own" on public.daily_logs
  for insert with check (auth.uid() = user_id);

create policy "daily_logs_update_own" on public.daily_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

notify pgrst, 'reload schema';
