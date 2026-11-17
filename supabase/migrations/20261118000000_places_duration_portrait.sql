-- Logbook update 2: places, durations, and an About portrait.
--
--   * Each trip gets a list of places (trip_places). Every place can carry its
--     own map pin, decide whether a route line is drawn to it, and hold its
--     own photos.
--   * Trips record a length in days (duration_days) next to their month.
--   * The About page can show a portrait (site_settings.portrait).
--
-- Safe to run on a site that already has trips and photos:
--   * Nothing is deleted, renamed, or overwritten.
--   * Existing places (trips.places) are copied into trip_places in the same
--     order, and each trip's existing pin is given to its first place.
--   * Existing photos keep their order and start out "not assigned to a
--     place"; the admin lets you assign them.
--   * The old columns trips.places, trips.lat, trips.lng and trips.end_date
--     stay where they are, untouched, so nothing is lost. The site no longer
--     reads them.
--   * Running this file a second time does nothing new.
--
-- Run it once in the Supabase SQL Editor (see README, "Updating").

begin;

-- ---------------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------------

create table if not exists public.trip_places (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  -- Where this place's pin sits on the map. City-level; null = no pin.
  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  -- Draw a route line from home to this pin, or just mark the spot.
  show_route boolean not null default true,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

create index if not exists trip_places_trip_order_idx
  on public.trip_places (trip_id, sort_order);

alter table public.photos
  add column if not exists place_id uuid
  references public.trip_places (id) on delete set null;

create index if not exists photos_place_idx on public.photos (place_id);

-- Copy each trip's existing places across, keeping their order. The trip's
-- existing pin goes to its first place, with its route line on, which is
-- exactly how the map showed it before.
insert into public.trip_places (trip_id, name, sort_order, lat, lng, show_route)
select
  t.id,
  trim(p.name),
  p.position - 1,
  case when p.position = 1 then t.lat end,
  case when p.position = 1 then t.lng end,
  true
from public.trips t
cross join lateral unnest(t.places) with ordinality as p(name, position)
where length(trim(p.name)) > 0
  and not exists (select 1 from public.trip_places tp where tp.trip_id = t.id);

-- A trip that had a pin but no places: keep the pin, on a place named after
-- the trip (rename it in the admin).
insert into public.trip_places (trip_id, name, sort_order, lat, lng, show_route)
select t.id, t.title, 0, t.lat, t.lng, true
from public.trips t
where t.lat is not null
  and t.lng is not null
  and not exists (select 1 from public.trip_places tp where tp.trip_id = t.id);

-- Saves the order of a trip's places in one request (same idea as
-- reorder_photos). Runs with the caller's rights, so RLS still applies.
create or replace function public.reorder_trip_places(place_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.trip_places as tp
  set sort_order = o.position - 1
  from unnest(place_ids) with ordinality as o(id, position)
  where tp.id = o.id;
$$;

revoke all on function public.reorder_trip_places(uuid[]) from public;
grant execute on function public.reorder_trip_places(uuid[]) to authenticated;

alter table public.trip_places enable row level security;

grant select on public.trip_places to anon, authenticated;
grant insert, update, delete on public.trip_places to authenticated;

drop policy if exists "Places of published trips are public; admins see all" on public.trip_places;
create policy "Places of published trips are public; admins see all"
  on public.trip_places for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.trips t
      where t.id = trip_places.trip_id and t.status = 'published'
    )
  );

drop policy if exists "Admins add places" on public.trip_places;
create policy "Admins add places"
  on public.trip_places for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins edit places" on public.trip_places;
create policy "Admins edit places"
  on public.trip_places for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins delete places" on public.trip_places;
create policy "Admins delete places"
  on public.trip_places for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Trip length
-- ---------------------------------------------------------------------------

alter table public.trips
  add column if not exists duration_days integer
  check (duration_days between 1 and 366);

-- Trips entered with exact first and last days get their length worked out.
update public.trips
set duration_days = (end_date - start_date) + 1
where duration_days is null
  and start_date is not null
  and end_date is not null
  and end_date >= start_date
  and (end_date - start_date) + 1 <= 366;

-- ---------------------------------------------------------------------------
-- About portrait
-- ---------------------------------------------------------------------------
-- Stored like a photo: {storage_path, format, width, height, blur_data_url}.
-- The files live in the existing "photos" bucket under site/.

alter table public.site_settings
  add column if not exists portrait jsonb,
  add column if not exists portrait_alt text not null default '';

commit;
