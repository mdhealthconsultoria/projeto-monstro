-- Skeelo Evolution — reforço de segurança.
--
-- Achado real (não é invasão, é uma permissão restritiva demais que
-- quebra o produto): profiles_select_own só deixa cada usuário ler o
-- PRÓPRIO perfil. Mas js/services/communities.js embute `profiles` de
-- OUTRAS pessoas (mural, lista de membros, ranking) via PostgREST —
-- RLS bloqueava esse embed pra qualquer perfil que não fosse o do
-- próprio usuário, então nomes/apelidos de outras pessoas ficavam
-- vazios. Esta policy libera ver nome/apelido de quem compartilha uma
-- comunidade ativa com você — não abre pra qualquer estranho
-- autenticado, e a tabela profiles não tem e-mail nem dados de
-- saúde/fotos, então o que passa a ser visível é só o que já aparece
-- publicamente numa comunidade (nome de exibição).

create policy "profiles_select_community_peers" on public.profiles
  for select using (
    exists (
      select 1
      from public.community_members cm_me
      join public.community_members cm_them
        on cm_them.community_id = cm_me.community_id
      where cm_me.user_id = auth.uid()
        and cm_me.status = 'active'
        and cm_them.user_id = profiles.id
        and cm_them.status = 'active'
    )
  );
