-- Skeelo Evolution — initial schema (Fase 2a: auth real + sincronização de estado)
--
-- Escopo desta migration: perfis, papéis (member/moderator/admin) e um
-- documento de estado por usuário (JSONB) que espelha o mesmo formato já
-- usado no IndexedDB local — treinos, hábitos, checklist, testes, IMC.
-- Comunidades/desafios/painel admin ganham suas próprias tabelas normalizadas
-- numa migration futura; por enquanto o app_roles já existe e já está
-- protegido, para quando isso for construído não exigir retrabalho de
-- segurança.
--
-- Fotos continuam apenas locais (IndexedDB) nesta fase — Storage entra depois.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  nickname text not null default '',
  timezone text not null default 'UTC',
  onboarding_complete boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ---------- app_roles ----------
-- Deliberadamente SEM policy de insert/update/delete para usuários comuns:
-- a promoção a moderator/admin só pode acontecer pelo SQL Editor do
-- Supabase Dashboard ou por uma função server-side protegida no futuro.
-- Um usuário nunca consegue alterar o próprio papel pelo app.
create table if not exists public.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.app_roles enable row level security;

create policy "app_roles_select_own" on public.app_roles
  for select using (auth.uid() = user_id);

-- ---------- user_app_state ----------
-- Um documento por usuário, mesmo formato do blob que já existe no
-- IndexedDB local. updated_at é usado pelo app para decidir, na sincronização,
-- qual versão (local ou nuvem) é mais recente — nunca sobrescreve
-- silenciosamente um registro mais novo.
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

create policy "state_select_own" on public.user_app_state
  for select using (auth.uid() = user_id);

create policy "state_insert_own" on public.user_app_state
  for insert with check (auth.uid() = user_id);

create policy "state_update_own" on public.user_app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "state_delete_own" on public.user_app_state
  for delete using (auth.uid() = user_id);

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists state_set_updated_at on public.user_app_state;
create trigger state_set_updated_at
  before update on public.user_app_state
  for each row execute function public.set_updated_at();

-- ---------- cria perfil + papel + estado vazio automaticamente no cadastro ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, nickname, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  );
  insert into public.app_roles (user_id, role) values (new.id, 'member');
  insert into public.user_app_state (user_id, state) values (new.id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
