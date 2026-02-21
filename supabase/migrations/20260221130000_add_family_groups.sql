create extension if not exists pgcrypto with schema extensions;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (family_id, profile_id)
);

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  token text unique not null,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles
add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.children
add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.children
add column if not exists created_by uuid references public.profiles (id) on delete set null;

update public.children
set created_by = user_id
where created_by is null;

update public.children as c
set family_id = p.family_id
from public.profiles as p
where c.user_id = p.id
  and c.family_id is null
  and p.family_id is not null;

create index if not exists profiles_family_id_idx
on public.profiles (family_id);

create index if not exists children_family_id_idx
on public.children (family_id);

create index if not exists children_created_by_idx
on public.children (created_by);

create index if not exists family_members_profile_id_idx
on public.family_members (profile_id);

create index if not exists family_invites_family_id_idx
on public.family_invites (family_id);

create index if not exists family_invites_token_idx
on public.family_invites (token);

create or replace function public.current_user_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id
  from public.profiles
  where id = auth.uid();
$$;

grant execute on function public.current_user_family_id() to authenticated;

create or replace function public.accept_family_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.family_invites%rowtype;
  requester_id uuid := auth.uid();
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.family_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if invite_record.accepted_at is not null then
    raise exception 'Invite already accepted';
  end if;

  if invite_record.expires_at <= timezone('utc'::text, now()) then
    raise exception 'Invite expired';
  end if;

  update public.profiles
  set family_id = invite_record.family_id
  where id = requester_id;

  insert into public.family_members (family_id, profile_id, role)
  values (invite_record.family_id, requester_id, 'member')
  on conflict (family_id, profile_id) do nothing;

  update public.family_invites
  set accepted_by = requester_id,
      accepted_at = timezone('utc'::text, now())
  where id = invite_record.id
    and accepted_at is null;

  return invite_record.family_id;
end;
$$;

grant execute on function public.accept_family_invite(text) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;

-- Families policies
create policy "Members can view families"
on public.families
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members as fm
    where fm.family_id = families.id
      and fm.profile_id = auth.uid()
  )
);

create policy "Authenticated users can create families"
on public.families
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Family admins can update families"
on public.families
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.family_members as fm
    where fm.family_id = families.id
      and fm.profile_id = auth.uid()
      and fm.role = 'admin'
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.family_members as fm
    where fm.family_id = families.id
      and fm.profile_id = auth.uid()
      and fm.role = 'admin'
  )
);

-- Family members policies
create policy "Members can view family members"
on public.family_members
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members as viewer
    where viewer.family_id = family_members.family_id
      and viewer.profile_id = auth.uid()
  )
);

create policy "Admins can insert family members"
on public.family_members
for insert
to authenticated
with check (
  (
    profile_id = auth.uid()
    and role = 'admin'
    and not exists (
      select 1
      from public.family_members as existing
      where existing.family_id = family_members.family_id
    )
  )
  or exists (
    select 1
    from public.family_members as admin_member
    where admin_member.family_id = family_members.family_id
      and admin_member.profile_id = auth.uid()
      and admin_member.role = 'admin'
  )
);

create policy "Admins can delete family members"
on public.family_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.family_members as admin_member
    where admin_member.family_id = family_members.family_id
      and admin_member.profile_id = auth.uid()
      and admin_member.role = 'admin'
  )
);

-- Family invites policies
create policy "Members can view family invites"
on public.family_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members as fm
    where fm.family_id = family_invites.family_id
      and fm.profile_id = auth.uid()
  )
);

create policy "Members can create family invites"
on public.family_invites
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and expires_at > timezone('utc'::text, now())
  and exists (
    select 1
    from public.family_members as fm
    where fm.family_id = family_invites.family_id
      and fm.profile_id = auth.uid()
  )
);

create policy "Authenticated users can accept valid invites"
on public.family_invites
for update
to authenticated
using (
  token is not null
  and accepted_at is null
  and expires_at > timezone('utc'::text, now())
)
with check (
  accepted_by = auth.uid()
  and accepted_at is not null
);

-- Replace existing table policies for family-aware reads and owner writes.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own and family profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    family_id is not null
    and family_id = public.current_user_family_id()
  )
);

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

drop policy if exists "Users can view own children" on public.children;
drop policy if exists "Users can create own children" on public.children;
drop policy if exists "Users can update own children" on public.children;
drop policy if exists "Users can delete own children" on public.children;

create policy "Users can view own and family children"
on public.children
for select
to authenticated
using (
  created_by = auth.uid()
  or (
    family_id is not null
    and family_id = public.current_user_family_id()
  )
);

create policy "Users can create own children"
on public.children
for insert
to authenticated
with check (
  user_id = auth.uid()
  and created_by = auth.uid()
  and (
    family_id is null
    or family_id = public.current_user_family_id()
  )
);

create policy "Users can update own children"
on public.children
for update
to authenticated
using (created_by = auth.uid())
with check (
  created_by = auth.uid()
  and user_id = auth.uid()
  and (
    family_id is null
    or family_id = public.current_user_family_id()
  )
);

create policy "Users can delete own children"
on public.children
for delete
to authenticated
using (created_by = auth.uid());

drop policy if exists "Users can view own profile measurements" on public.profile_measurements;
drop policy if exists "Users can create own profile measurements" on public.profile_measurements;
drop policy if exists "Users can update own profile measurements" on public.profile_measurements;

create policy "Users can view family profile measurements"
on public.profile_measurements
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as p
    where p.id = profile_measurements.profile_id
      and (
        p.id = auth.uid()
        or (
          p.family_id is not null
          and p.family_id = public.current_user_family_id()
        )
      )
  )
);

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

drop policy if exists "Users can view own child measurements" on public.child_measurements;
drop policy if exists "Users can create own child measurements" on public.child_measurements;
drop policy if exists "Users can update own child measurements" on public.child_measurements;

create policy "Users can view family child measurements"
on public.child_measurements
for select
to authenticated
using (
  exists (
    select 1
    from public.children as c
    where c.id = child_measurements.child_id
      and (
        c.created_by = auth.uid()
        or (
          c.family_id is not null
          and c.family_id = public.current_user_family_id()
        )
      )
  )
);

create policy "Users can create own child measurements"
on public.child_measurements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.children as c
    where c.id = child_measurements.child_id
      and c.created_by = auth.uid()
  )
);

create policy "Users can update own child measurements"
on public.child_measurements
for update
to authenticated
using (
  exists (
    select 1
    from public.children as c
    where c.id = child_measurements.child_id
      and c.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children as c
    where c.id = child_measurements.child_id
      and c.created_by = auth.uid()
  )
);
