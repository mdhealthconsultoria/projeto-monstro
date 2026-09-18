-- Skeelo Evolution — Moderação básica de comunidades: denúncias + bloqueio.
--
-- Duas peças independentes:
--   1. community_reports — denúncia de um post ou de um membro, dentro de
--      uma comunidade. Só quem é owner/admin/moderator daquela comunidade
--      consegue LER as denúncias (além de quem denunciou, só o status da
--      própria denúncia). Resolver/descartar também é só staff.
--   2. blocked_users — bloqueio pessoal, independente de comunidade (não
--      precisa ser staff pra bloquear alguém). É só uma lista privada por
--      usuário; o app filtra client-side o que vem de gente bloqueada (mural,
--      ranking) — não precisa de lógica nova no servidor pra isso.

-- ---------- community_reports ----------
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'member')),
  target_post_id uuid references public.community_posts(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'post' and target_post_id is not null)
    or (target_type = 'member' and target_user_id is not null)
  )
);

alter table public.community_reports enable row level security;

create policy "reports_insert_self" on public.community_reports
  for insert with check (
    auth.uid() = reporter_id and public.is_community_member(community_id)
  );

-- Staff vê tudo da própria comunidade; quem denunciou vê só a própria denúncia.
create policy "reports_select" on public.community_reports
  for select using (
    auth.uid() = reporter_id
    or public.community_role(community_id) in ('owner', 'admin', 'moderator')
  );

create policy "reports_update_by_staff" on public.community_reports
  for update using (
    public.community_role(community_id) in ('owner', 'admin', 'moderator')
  ) with check (
    public.community_role(community_id) in ('owner', 'admin', 'moderator')
  );

create index if not exists idx_community_reports_community on public.community_reports(community_id, status);

-- Segunda FK pra profiles (além da já existente pra auth.users) — PostgREST
-- só embute `profiles` numa query se houver uma FK DIRETA pra ela, não
-- basta um ancestral comum (mesmo padrão de 0003_communities_profile_fk.sql).
alter table public.community_reports
  add constraint community_reports_reporter_profile_fkey
  foreign key (reporter_id) references public.profiles(id) on delete cascade;

alter table public.community_reports
  add constraint community_reports_target_user_profile_fkey
  foreign key (target_user_id) references public.profiles(id) on delete cascade;

-- ---------- blocked_users ----------
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

-- Só você vê e gerencia a própria lista — ninguém consegue checar se foi
-- bloqueado por outra pessoa (evita constrangimento/represália).
create policy "blocked_users_select_own" on public.blocked_users
  for select using (auth.uid() = blocker_id);

create policy "blocked_users_insert_own" on public.blocked_users
  for insert with check (auth.uid() = blocker_id);

create policy "blocked_users_delete_own" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

alter table public.blocked_users
  add constraint blocked_users_blocked_profile_fkey
  foreign key (blocked_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
