-- Controle de concorrência otimista em user_app_state: hoje dois aparelhos
-- sincronizando ao mesmo tempo fazem upsert do blob inteiro sem checar
-- versão, e o último a escrever apaga silenciosamente o que o outro gravou.
--
-- Com essa coluna, js/store.js#pushToCloud passa a fazer um UPDATE
-- condicional (`where revision = <revisão que o cliente leu>`), incrementando
-- a revisão a cada escrita bem-sucedida. Se 0 linhas forem afetadas, o
-- cliente busca o remoto de novo, faz merge (js/merge.js) e tenta de novo.
alter table public.user_app_state
  add column if not exists revision integer not null default 0;

-- Linhas já existentes (criadas antes desta migration) começam em revisão 0,
-- que é exatamente o valor inicial que o client assume para uma linha nunca
-- lida ainda — não precisa de backfill.
