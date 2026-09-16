-- Skeelo Evolution — Painel administrativo (acesso mestre).
--
-- Só quem estiver em platform_admins acessa qualquer dado deste arquivo.
-- Essa tabela não tem NENHUMA policy (nem select) — só alterável direto
-- pelo SQL Editor, nunca pelo app. Todas as funções abaixo checam
-- is_platform_admin() internamente e devolvem só agregados ou campos
-- não-sensíveis (nunca fotos, peso, IMC, sintomas ou reflexões de
-- outros usuários — essas colunas nem existem em tabela normalizada
-- ainda, então essa garantia já é automática).

-- ---------- platform_admins ----------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- (nenhuma policy de propósito — ninguém lê/escreve via API)

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Concede acesso mestre ao e-mail do Matheus, SE essa conta já existir.
-- Se ainda não existir (cadastro feito depois), rode manualmente:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'matheusdavid13723@gmail.com'
--   on conflict (user_id) do nothing;
insert into public.platform_admins (user_id)
select id from auth.users where email = 'matheusdavid13723@gmail.com'
on conflict (user_id) do nothing;

-- ---------- suspensão de conta ----------
alter table public.profiles add column if not exists suspended boolean not null default false;

-- ---------- visão geral ----------
create or replace function public.admin_overview_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'onboarding_complete_count', (select count(*) from public.profiles where onboarding_complete = true),
    'challenge_started_count', (select count(*) from public.user_app_state where state->>'startDate' is not null),
    'total_communities', (select count(*) from public.communities),
    'public_communities', (select count(*) from public.communities where visibility = 'public'),
    'private_communities', (select count(*) from public.communities where visibility = 'private'),
    'active_memberships', (select count(*) from public.community_members where status = 'active'),
    'pending_join_requests', (select count(*) from public.community_members where status = 'pending'),
    'total_challenges', (select count(*) from public.challenges),
    'active_challenges', (select count(*) from public.challenges where now() between starts_at and ends_at),
    'scores_last_7d', (select count(*) from public.challenge_daily_scores where created_at > now() - interval '7 days'),
    'suspended_users', (select count(*) from public.profiles where suspended = true)
  ) into result;

  return result;
end;
$$;

-- ---------- insights de produto ----------
create or replace function public.admin_insights()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'goal_distribution', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select coalesce(nullif(preferences->>'goal', ''), '(não definido)') as goal, count(*) as total
        from public.profiles group by 1 order by 2 desc
      ) t
    ),
    'inspiration_distribution', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select coalesce(nullif(preferences->>'inspiration', ''), '(não definido)') as inspiration, count(*) as total
        from public.profiles group by 1 order by 2 desc
      ) t
    ),
    'top_communities', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select name, category, visibility, member_count
        from public.communities order by member_count desc limit 5
      ) t
    ),
    'top_challenges', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select c.title, c.action_type, count(p.user_id) as participants
        from public.challenges c
        left join public.challenge_participants p on p.challenge_id = c.id and p.status = 'active'
        group by c.id, c.title, c.action_type
        order by participants desc limit 5
      ) t
    )
  ) into result;

  return result;
end;
$$;

-- ---------- busca de usuários (gestão) ----------
create or replace function public.admin_search_users(p_query text default '')
returns table (
  id uuid, name text, nickname text, email text,
  created_at timestamptz, onboarding_complete boolean, suspended boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.name, p.nickname, u.email, p.created_at, p.onboarding_complete, p.suspended
    from public.profiles p
    join auth.users u on u.id = p.id
    where p_query = '' or p_query is null
       or p.name ilike '%' || p_query || '%'
       or p.nickname ilike '%' || p_query || '%'
       or u.email ilike '%' || p_query || '%'
    order by p.created_at desc
    limit 50;
end;
$$;

-- ---------- suspender / reativar conta ----------
create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode suspender a própria conta';
  end if;
  update public.profiles set suspended = p_suspended where id = p_user_id;
end;
$$;
