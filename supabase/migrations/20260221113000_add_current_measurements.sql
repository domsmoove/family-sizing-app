create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profile_measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles (id) on delete cascade,
  height_cm numeric,
  weight_kg numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  inseam_cm numeric,
  shoe_size numeric,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.child_measurements (
  id uuid primary key default gen_random_uuid(),
  child_id uuid unique not null references public.children (id) on delete cascade,
  height_cm numeric,
  weight_kg numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  inseam_cm numeric,
  shoe_size numeric,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists profile_measurements_profile_id_idx
on public.profile_measurements (profile_id);

create index if not exists child_measurements_child_id_idx
on public.child_measurements (child_id);

alter table public.profile_measurements enable row level security;
alter table public.child_measurements enable row level security;

create policy "Users can view own profile measurements"
on public.profile_measurements
for select
to authenticated
using (profile_id = auth.uid());

create policy "Users can create own profile measurements"
on public.profile_measurements
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "Users can update own profile measurements"
on public.profile_measurements
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Users can view own child measurements"
on public.child_measurements
for select
to authenticated
using (
  exists (
    select 1
    from public.children
    where children.id = child_measurements.child_id
      and children.user_id = auth.uid()
  )
);

create policy "Users can create own child measurements"
on public.child_measurements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.children
    where children.id = child_measurements.child_id
      and children.user_id = auth.uid()
  )
);

create policy "Users can update own child measurements"
on public.child_measurements
for update
to authenticated
using (
  exists (
    select 1
    from public.children
    where children.id = child_measurements.child_id
      and children.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children
    where children.id = child_measurements.child_id
      and children.user_id = auth.uid()
  )
);
