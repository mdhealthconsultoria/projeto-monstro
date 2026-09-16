-- Fix: PostgREST embedding (e.g. `select('*, profile:profiles(name, nickname)')`)
-- needs a DIRECT foreign key to the embedded table. community_members/
-- community_posts/challenge_daily_scores only referenced auth.users(id), not
-- public.profiles(id) — even though every user always has both rows (the
-- signup trigger creates them together), PostgREST can't infer the join
-- through a shared ancestor. Adding these second FKs (safe: profiles.id is
-- always = auth.users.id) makes the embeds in js/services/communities.js work.

alter table public.community_members
  add constraint community_members_user_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.community_posts
  add constraint community_posts_user_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.challenge_daily_scores
  add constraint challenge_daily_scores_user_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
