-- =============================================================================
-- Auto-Wieliński — Complete database setup
-- Run this in the Supabase SQL Editor of a fresh project to recreate the schema.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'editor');
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- 2. Shared helper functions
-- ----------------------------------------------------------------------------

-- Keeps updated_at fresh on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Role check used by RLS policies (SECURITY DEFINER avoids recursive RLS).
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Public check: does any admin account already exist? (bootstrap registration)
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where role = 'admin'::public.app_role)
$$;

-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------

-- profiles ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "users view own profile" on public.profiles;
create policy "users view own profile" on public.profiles
  for select to authenticated
  using ((id = auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "user updates own profile" on public.profiles;
create policy "user updates own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid());

drop policy if exists "admin updates any profile" on public.profiles;
create policy "admin updates any profile" on public.profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles -------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "view own or admin all roles" on public.user_roles;
create policy "view own or admin all roles" on public.user_roles
  for select to authenticated
  using ((user_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "only admins insert roles" on public.user_roles;
create policy "only admins insert roles" on public.user_roles
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "only admins update roles" on public.user_roles;
create policy "only admins update roles" on public.user_roles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "only admins delete roles" on public.user_roles;
create policy "only admins delete roles" on public.user_roles
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- cars -------------------------------------------------------------------------
create table if not exists public.cars (
  id                  uuid primary key default gen_random_uuid(),
  brand               text not null,
  model               text not null,
  year                integer not null,
  mileage_km          integer not null,
  mileage_unit        text not null default 'km',
  price_pln           numeric not null,
  fuel                text,
  transmission        text,
  power_hp            integer,
  engine_capacity_cm3 integer,
  body_type           text,
  color               text,
  phone               text,
  description         text,
  images              text[] not null default '{}'::text[],
  video_url           text,
  is_sold             boolean not null default false,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cars_created_at_idx on public.cars(created_at desc);
create index if not exists cars_brand_idx on public.cars(brand);
create index if not exists cars_is_sold_idx on public.cars(is_sold);

grant select on public.cars to anon, authenticated;
grant insert, update, delete on public.cars to authenticated;
grant all on public.cars to service_role;

alter table public.cars enable row level security;

drop policy if exists "anyone reads cars" on public.cars;
create policy "anyone reads cars" on public.cars
  for select to anon, authenticated
  using (true);

drop policy if exists "editors insert cars" on public.cars;
create policy "editors insert cars" on public.cars
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "editors update cars" on public.cars;
create policy "editors update cars" on public.cars
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "admin deletes cars" on public.cars;
create policy "admin deletes cars" on public.cars
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Keep cars.updated_at current.
drop trigger if exists set_cars_updated_at on public.cars;
create trigger set_cars_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. New-user handling (first account becomes admin; further signups blocked)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block any registration once an administrator already exists.
  if exists (select 1 from public.user_roles where role = 'admin'::public.app_role) then
    raise exception 'Rejestracja jest zamknięta — administrator już istnieje.';
  end if;

  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- First account becomes the administrator (bootstrap).
  insert into public.user_roles (user_id, role)
  values (new.id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Function privileges
-- ----------------------------------------------------------------------------
revoke all on function public.admin_exists() from public;
grant execute on function public.admin_exists() to anon, authenticated;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Storage bucket for car media (private)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('car-media', 'car-media', false)
on conflict (id) do nothing;

-- =============================================================================
-- Done. The first user who signs up automatically becomes the administrator.
-- =============================================================================
