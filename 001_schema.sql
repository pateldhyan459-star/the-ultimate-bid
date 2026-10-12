-- =====================================================================
-- THE ULTIMATE BID  |  Migration 001: tables
-- Run this FIRST in the Supabase SQL Editor.
-- Money is stored as whole credits (bigint). No decimals, no rounding bugs.
-- =====================================================================

-- Administrator allow-list. Being signed in is NOT enough to be an admin;
-- your user id must also be listed here. Only you can add rows (see
-- supabase/manual/add_admin.sql). The browser can never write to this table.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id             uuid primary key default gen_random_uuid(),
  -- Same 6-character alphabet as src/config/event.ts (no 0, O, 1, I, L).
  code           text not null unique
                 check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  name           text not null check (char_length(name) between 2 and 80),
  status         text not null default 'draft'
                 check (status in ('draft', 'lobby', 'live', 'paused', 'ended')),
  default_budget bigint not null default 1000000 check (default_budget >= 0),
  min_increment  bigint not null default 10000   check (min_increment >= 1),
  timer_seconds  integer not null default 30     check (timer_seconds between 5 and 600),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 40),
  budget     bigint not null check (budget >= 0),   -- starting budget, whole credits
  created_at timestamptz not null default now()
);
-- Team names are unique per room, ignoring upper/lower case.
create unique index teams_room_name_unique on public.teams (room_id, lower(name));

create table public.participants (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  team_id      uuid references public.teams (id) on delete set null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'removed')),
  joined_at    timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.lots (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms (id) on delete cascade,
  position        integer not null check (position >= 1),
  name            text not null check (char_length(name) between 1 and 120),
  description     text,
  category        text,
  base_price      bigint not null check (base_price >= 0),
  min_increment   bigint check (min_increment >= 1),  -- null = use the room default
  status          text not null default 'upcoming'
                  check (status in ('upcoming', 'live', 'paused', 'sold', 'unsold')),
  current_bid     bigint check (current_bid >= 0),
  current_team_id uuid references public.teams (id) on delete set null,
  ends_at         timestamptz,                         -- the SERVER clock decides this
  created_at      timestamptz not null default now(),
  unique (room_id, position)
);

create table public.bids (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  lot_id         uuid not null references public.lots (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  amount         bigint not null check (amount > 0),
  created_at     timestamptz not null default now()
);

create table public.purchases (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  lot_id     uuid not null unique references public.lots (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  price      bigint not null check (price >= 0),
  created_at timestamptz not null default now()
);

-- Indexes for the lookups the later stages do constantly.
create index participants_user_idx   on public.participants (user_id);
create index participants_room_idx   on public.participants (room_id);
create index teams_room_idx          on public.teams (room_id);
create index lots_room_idx           on public.lots (room_id, position);
create index bids_lot_idx            on public.bids (lot_id, amount desc);
create index purchases_room_idx      on public.purchases (room_id);

-- Keep rooms.updated_at honest.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();
