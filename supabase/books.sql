-- Run this in the Supabase dashboard: SQL Editor → New query → Run
create table if not exists public.books (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null,
  year int,
  genre text,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "Public read access" on public.books;
create policy "Public read access" on public.books
  for select to anon, authenticated using (true);

insert into public.books (title, author, year, genre) values
  ('To Kill a Mockingbird', 'Harper Lee', 1960, 'Fiction'),
  ('1984', 'George Orwell', 1949, 'Dystopian'),
  ('Pride and Prejudice', 'Jane Austen', 1813, 'Romance'),
  ('The Hobbit', 'J.R.R. Tolkien', 1937, 'Fantasy'),
  ('Sapiens', 'Yuval Noah Harari', 2011, 'Non-fiction'),
  ('The Great Gatsby', 'F. Scott Fitzgerald', 1925, 'Fiction');
