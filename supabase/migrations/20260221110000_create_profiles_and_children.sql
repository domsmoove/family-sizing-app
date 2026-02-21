create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  full_name text
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  birthdate date not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists children_user_id_idx on public.children (user_id);

alter table public.children enable row level security;

create policy "Users can view own children"
on public.children
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own children"
on public.children
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own children"
on public.children
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own children"
on public.children
for delete
to authenticated
using (auth.uid() = user_id);
