-- CapCity: AI-captioned photos that logged-in users vote on.
--
-- RLS design (strictest that still works):
--   posts / captions : anyone can read (public feed). Nobody can insert/update/delete through the API;
--                      the server writes them with the secret key only after Gemini generates the captions,
--                      so users can't post fake "AI" captions.
--   votes            : users can only see, create, change and delete their OWN votes.
--   vote totals      : kept on captions/posts by a trigger, so nobody needs to read other people's votes.

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,          -- path in the "posts" storage bucket (no binary data in the DB)
  image_url text not null,           -- public URL of that file
  theme text not null,               -- daily theme the photo was posted under
  note text,                         -- optional context the uploader gave the AI
  score int not null default 0,      -- sum of all caption scores, maintained by trigger
  created_at timestamptz not null default now()
);

create table if not exists public.captions (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  text text not null,
  style text not null,
  prompt text not null,              -- the exact prompt sent to the model
  model text not null,               -- which model generated it
  upvotes int not null default 0,
  downvotes int not null default 0,
  score int generated always as (upvotes - downvotes) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id bigint generated always as identity primary key,
  caption_id bigint not null references public.captions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caption_id, user_id)       -- one vote per user per caption
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_score_idx on public.posts (score desc);
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists captions_post_id_idx on public.captions (post_id);
create index if not exists votes_user_id_idx on public.votes (user_id);

alter table public.posts enable row level security;
alter table public.captions enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can read captions" on public.captions;
create policy "Anyone can read captions" on public.captions
  for select to anon, authenticated using (true);

drop policy if exists "Users can read own votes" on public.votes;
create policy "Users can read own votes" on public.votes
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own votes" on public.votes;
create policy "Users can insert own votes" on public.votes
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own votes" on public.votes;
create policy "Users can update own votes" on public.votes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own votes" on public.votes;
create policy "Users can delete own votes" on public.votes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Users may only change the vote value, never move a vote to another caption or user.
revoke update on public.votes from anon, authenticated;
grant update (value, updated_at) on public.votes to authenticated;

-- Keep caption and post totals in sync with the votes table.
create or replace function public.apply_vote_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_up int := 0; old_down int := 0; new_up int := 0; new_down int := 0;
  cap_id bigint := coalesce(new.caption_id, old.caption_id);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_up := (old.value = 1)::int; old_down := (old.value = -1)::int;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_up := (new.value = 1)::int; new_down := (new.value = -1)::int;
  end if;

  update public.captions
     set upvotes = upvotes + new_up - old_up,
         downvotes = downvotes + new_down - old_down
   where id = cap_id;

  update public.posts p
     set score = p.score + (new_up - old_up) - (new_down - old_down)
    from public.captions c
   where c.id = cap_id and p.id = c.post_id;

  return null;
end;
$$;

revoke execute on function public.apply_vote_change() from public, anon, authenticated;

drop trigger if exists on_vote_change on public.votes;
create trigger on_vote_change
  after insert or update or delete on public.votes
  for each row execute function public.apply_vote_change();

-- Storage bucket for uploaded photos; each user uploads into a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Users can upload own post images" on storage.objects;
create policy "Users can upload own post images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = (select auth.uid())::text);
