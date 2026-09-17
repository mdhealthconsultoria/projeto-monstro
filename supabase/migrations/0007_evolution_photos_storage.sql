-- Skeelo Evolution — Fotos de evolução na nuvem (Supabase Storage).
--
-- Até aqui as fotos ficavam só no IndexedDB do aparelho (nunca saíam dele).
-- Isso cria um bucket PRIVADO e políticas que restringem cada usuário à sua
-- própria pasta (primeiro segmento do caminho do arquivo = auth.uid()).
-- Nada aqui é público — leitura sempre via signed URL gerada sob demanda
-- pelo app (js/services/photosCloud.js), nunca por URL direta.
--
-- Rode isto no SQL Editor do Supabase. Depois disso o app passa a
-- sincronizar as fotos automaticamente — nada mais precisa ser feito.

insert into storage.buckets (id, name, public)
values ('evolution-photos', 'evolution-photos', false)
on conflict (id) do nothing;

drop policy if exists "evolution_photos_select_own" on storage.objects;
create policy "evolution_photos_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'evolution-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "evolution_photos_insert_own" on storage.objects;
create policy "evolution_photos_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'evolution-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "evolution_photos_update_own" on storage.objects;
create policy "evolution_photos_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'evolution-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'evolution-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "evolution_photos_delete_own" on storage.objects;
create policy "evolution_photos_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'evolution-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
