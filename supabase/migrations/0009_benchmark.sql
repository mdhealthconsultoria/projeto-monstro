-- Skeelo Evolution — Comparação anônima com pessoas da mesma faixa etária.
--
-- Decisão de arquitetura: o Montro Score é calculado no cliente (js/logic.js,
-- fórmula com vários fatores). Reimplementar essa fórmula em SQL criaria duas
-- versões que podem divergir com o tempo — uma armadilha de manutenção que
-- tornaria a comparação enganosa. Em vez disso, o cliente envia o PRÓPRIO
-- score já calculado (melhor esforço, na sincronização normal) pra uma
-- tabela pequena; o servidor só agrega, nunca recalcula.
--
-- Ninguém lê a tabela linha a linha — só a função abaixo, que devolve média +
-- contagem, e recusa responder se a amostra for pequena demais (privacidade:
-- evita reidentificar alguém numa faixa etária com poucas pessoas).

create table if not exists public.benchmark_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_bracket text not null check (age_bracket in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')),
  montro_score integer not null check (montro_score between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.benchmark_stats enable row level security;

-- Cada um só escreve a própria linha. Sem policy de select — nem o próprio
-- usuário lê a tabela direto (o app já sabe o próprio score); a única
-- leitura é agregada, via montro_score_benchmark() abaixo.
create policy "benchmark_stats_insert_own" on public.benchmark_stats
  for insert with check (auth.uid() = user_id);

create policy "benchmark_stats_update_own" on public.benchmark_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "benchmark_stats_delete_own" on public.benchmark_stats
  for delete using (auth.uid() = user_id);

create or replace function public.montro_score_benchmark(p_age_bracket text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_avg numeric;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select count(*), avg(montro_score) into v_count, v_avg
  from public.benchmark_stats
  where age_bracket = p_age_bracket;

  -- Amostra mínima antes de mostrar qualquer coisa — evita expor a média de
  -- um grupo tão pequeno que dá pra adivinhar quem é (k-anonimidade básica).
  if v_count is null or v_count < 5 then
    return json_build_object('available', false, 'sampleSize', coalesce(v_count, 0));
  end if;

  return json_build_object('available', true, 'sampleSize', v_count, 'average', round(v_avg));
end;
$$;
