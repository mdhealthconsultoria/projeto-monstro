-- Skeelo Evolution — Fase 2b: comunidades e desafios em grupo.
--
-- Escopo desta migration: comunidades reais (buscar/criar/entrar/aprovar/
-- mural/sair), papéis (owner/admin/moderator/member), e desafios com
-- ranking próprio (challenge_score), sem depender do XP global.
--
-- Decisões de escopo (ver 04-projetos/skeelo-evolution-visao-mestra.md no
-- Obsidian do projeto):
--   - Sem tabela de denúncias/moderação ainda — fica para quando o painel
--     admin for construído.
--   - "Pedido de entrada" é só um status (pending) dentro de
--     community_members, não uma tabela separada.
--   - Pagamentos: campos presentes e inertes (payment_status default
--     'not_required'), nunca ativados nesta fase.

-- ---------- communities ----------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  category text not null default 'outro'
    check (category in ('academia','calistenia','core','ingles','produtividade','fe','leitura','disciplina','outro')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  member_count integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communities enable row level security;

-- ---------- community_members ----------
create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','moderator','member')),
  status text not null default 'active' check (status in ('pending','active','banned')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_members enable row level security;

-- ---------- helper functions (security definer: evitam RLS recursiva) ----------
create or replace function public.is_community_member(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.community_role(cid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.community_members
  where community_id = cid and user_id = auth.uid() and status = 'active';
$$;

-- ---------- communities policies ----------
-- The communities row itself has no sensitive columns (name/description/
-- category/visibility/member_count) — private only gates membership, posts
-- and challenges, not discoverability. Anyone signed in can find and request
-- to join a private community, same as the "solicitar entrada" flow needs.
create policy "communities_select" on public.communities
  for select using (auth.uid() is not null);

create policy "communities_insert" on public.communities
  for insert with check (auth.uid() = created_by);

create policy "communities_update_owner" on public.communities
  for update using (public.community_role(id) = 'owner') with check (public.community_role(id) = 'owner');

create policy "communities_delete_owner" on public.communities
  for delete using (public.community_role(id) = 'owner');

-- ---------- community_members policies ----------
create policy "members_select_own_row" on public.community_members
  for select using (auth.uid() = user_id);

create policy "members_select_fellow_members" on public.community_members
  for select using (public.is_community_member(community_id));

-- Only insert your OWN row, and only as a plain member (never grant yourself a role).
create policy "members_insert_self" on public.community_members
  for insert with check (auth.uid() = user_id and role = 'member');

-- Owners/admins manage other members' role/status; nobody edits their own row this way
-- (leaving/approving your own pending row is handled by members_delete_self below).
create policy "members_update_by_admin" on public.community_members
  for update using (
    public.community_role(community_id) in ('owner','admin') and auth.uid() <> user_id
  ) with check (
    public.community_role(community_id) in ('owner','admin') and auth.uid() <> user_id
  );

create policy "members_delete_self" on public.community_members
  for delete using (auth.uid() = user_id);

create policy "members_delete_by_admin" on public.community_members
  for delete using (public.community_role(community_id) in ('owner','admin'));

-- ---------- community_posts ----------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

create policy "posts_select" on public.community_posts
  for select using (public.is_community_member(community_id));

create policy "posts_insert" on public.community_posts
  for insert with check (auth.uid() = user_id and public.is_community_member(community_id));

create policy "posts_delete_own" on public.community_posts
  for delete using (auth.uid() = user_id);

create policy "posts_delete_by_admin" on public.community_posts
  for delete using (public.community_role(community_id) in ('owner','admin','moderator'));

-- ---------- challenges ----------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text not null default '',
  action_type text not null check (action_type in ('treino','habito','ingles','checklist','personalizado')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  points_per_action integer not null default 10 check (points_per_action > 0),
  max_participants integer,
  visibility text not null default 'community' check (visibility in ('community','public')),
  image_url text,
  entry_fee_amount numeric,
  currency text default 'BRL',
  prize_description text,
  payment_status text not null default 'not_required' check (payment_status in ('not_required','pending_setup')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.challenges enable row level security;

create policy "challenges_select" on public.challenges
  for select using (visibility = 'public' or public.is_community_member(community_id));

create policy "challenges_insert_by_admin" on public.challenges
  for insert with check (
    auth.uid() = created_by and public.community_role(community_id) in ('owner','admin')
  );

create policy "challenges_update_by_admin" on public.challenges
  for update using (public.community_role(community_id) in ('owner','admin'))
  with check (public.community_role(community_id) in ('owner','admin'));

create policy "challenges_delete_by_admin" on public.challenges
  for delete using (public.community_role(community_id) in ('owner','admin'));

-- ---------- challenge_participants ----------
create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','left')),
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

create or replace function public.is_challenge_participant(chid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenge_participants
    where challenge_id = chid and user_id = auth.uid() and status = 'active'
  );
$$;

create policy "participants_select" on public.challenge_participants
  for select using (
    exists (select 1 from public.challenges c where c.id = challenge_id and public.is_community_member(c.community_id))
  );

create policy "participants_insert_self" on public.challenge_participants
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.challenges c where c.id = challenge_id and public.is_community_member(c.community_id))
  );

create policy "participants_update_self" on public.challenge_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- challenge_daily_scores ----------
-- No insert/update policy for regular users on purpose — the only way in is
-- record_challenge_action() below, which enforces the window, the action
-- type, and the fixed point value server-side.
create table if not exists public.challenge_daily_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  action_type text not null,
  points integer not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, date)
);

alter table public.challenge_daily_scores enable row level security;

create policy "scores_select" on public.challenge_daily_scores
  for select using (
    exists (select 1 from public.challenges c where c.id = challenge_id and public.is_community_member(c.community_id))
  );

create or replace function public.record_challenge_action(p_challenge_id uuid, p_action_type text)
returns public.challenge_daily_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  ch public.challenges;
  inserted public.challenge_daily_scores;
begin
  select * into ch from public.challenges where id = p_challenge_id;
  if ch.id is null then
    raise exception 'Desafio não encontrado';
  end if;

  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'Você não está participando deste desafio';
  end if;

  if now() < ch.starts_at or now() > ch.ends_at then
    raise exception 'Este desafio não está na janela ativa';
  end if;

  if p_action_type <> ch.action_type then
    raise exception 'Tipo de ação não corresponde a este desafio';
  end if;

  insert into public.challenge_daily_scores (challenge_id, user_id, date, action_type, points)
  values (p_challenge_id, auth.uid(), (now() at time zone coalesce(ch.timezone, 'UTC'))::date, p_action_type, ch.points_per_action)
  on conflict (challenge_id, user_id, date) do nothing
  returning * into inserted;

  if inserted.id is null then
    raise exception 'Você já registrou este desafio hoje';
  end if;

  return inserted;
end;
$$;

-- ---------- member_count automático ----------
create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'active')
     or (tg_op = 'UPDATE' and new.status = 'active' and old.status <> 'active') then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  elsif (tg_op = 'DELETE' and old.status = 'active')
     or (tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active') then
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_members_sync_count on public.community_members;
create trigger community_members_sync_count
  after insert or update or delete on public.community_members
  for each row execute function public.sync_community_member_count();

-- ---------- cria a comunidade + torna o criador owner automaticamente ----------
create or replace function public.handle_new_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_members (community_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active');
  return new;
end;
$$;

drop trigger if exists on_community_created on public.communities;
create trigger on_community_created
  after insert on public.communities
  for each row execute function public.handle_new_community();

-- ---------- updated_at automático ----------
drop trigger if exists communities_set_updated_at on public.communities;
create trigger communities_set_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.community_posts;
create trigger posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

-- ---------- índices ----------
create index if not exists idx_community_members_user on public.community_members(user_id);
create index if not exists idx_community_posts_community on public.community_posts(community_id, created_at desc);
create index if not exists idx_challenges_community on public.challenges(community_id);
create index if not exists idx_challenge_participants_user on public.challenge_participants(user_id);
create index if not exists idx_challenge_scores_challenge on public.challenge_daily_scores(challenge_id);
