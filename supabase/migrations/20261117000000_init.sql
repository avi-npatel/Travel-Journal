-- Logbook: schema, row level security, and storage bucket.
--
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
-- It is safe to read top to bottom: tables first, then who may touch them.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
-- A user is an admin only if their id is in this table. Nothing can read or
-- write it through the API (RLS is on and there are no policies); rows are
-- added by hand in the SQL editor. See README, "Create your admin account".

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- security definer so policies can ask "is the caller an admin?" without the
-- caller being able to read the admins table.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (length(trim(title)) > 0),
  status           text not null default 'draft'
                   check (status in ('draft', 'published')),

  -- ISO 3166-1 alpha-2 codes, e.g. {PT} or {NO,SE}.
  country_codes    text[] not null default '{}',
  places           text[] not null default '{}',
  tags             text[] not null default '{}',

  start_date       date,
  end_date         date,
  -- 'month' means only the month is known; the day in start_date is ignored.
  date_precision   text not null default 'day'
                   check (date_precision in ('day', 'month')),

  summary          text not null default '',
  description_html text not null default '',

  -- Where the trip's pin sits on the map. City-level, never an exact address.
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),

  cover_photo_id   uuid,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_status_start_date_idx
  on public.trips (status, start_date desc nulls last);

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------
-- Each photo is stored in the "photos" bucket as three files:
--   <storage_path>-full.<ext>   up to 2400px on the long edge
--   <storage_path>-md.<ext>     up to 1400px wide
--   <storage_path>-thumb.<ext>  up to 640px wide
-- All three are re-encoded in the browser, which removes every EXIF tag
-- (including GPS) before the file ever leaves the admin's computer.

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  storage_path  text not null unique,
  format        text not null check (format in ('webp', 'jpeg')),
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  caption       text not null default '',
  sort_order    integer not null default 0,
  blur_data_url text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index photos_trip_order_idx on public.photos (trip_id, sort_order);

alter table public.trips
  add constraint trips_cover_photo_fk
  foreign key (cover_photo_id) references public.photos (id) on delete set null;

-- Exact GPS coordinates read from EXIF. Kept apart from `photos` so they can
-- be locked to admins: the public site never receives them.
create table public.photo_locations (
  photo_id uuid primary key references public.photos (id) on delete cascade,
  lat      double precision not null check (lat between -90 and 90),
  lng      double precision not null check (lng between -180 and 180)
);

-- ---------------------------------------------------------------------------
-- Site settings (always exactly one row)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id                  boolean primary key default true check (id),
  site_title          text not null default 'Logbook',
  site_description    text not null default '',
  about_html          text not null default '',
  -- Countries visited that do not have a trip written up yet. They count
  -- toward the map and the stats.
  extra_country_codes text[] not null default '{}',
  -- Where routes and distances are measured from.
  home_name           text not null default 'Charlotte, NC',
  home_code           text not null default 'CLT',
  home_lat            double precision not null default 35.2271,
  home_lng            double precision not null default -80.8431,
  updated_at          timestamptz not null default now()
);

insert into public.site_settings default values;

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Reordering photos
-- ---------------------------------------------------------------------------
-- Saves a whole gallery order in one request: each photo's position in the
-- array (counting from 0) becomes its sort_order. It runs with the caller's own rights, so the
-- row level security below still decides whether the update is allowed.

create function public.reorder_photos(photo_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.photos as p
  set sort_order = o.position - 1
  from unnest(photo_ids) with ordinality as o(id, position)
  where p.id = o.id;
$$;

revoke all on function public.reorder_photos(uuid[]) from public;
grant execute on function public.reorder_photos(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Visitors (the "anon" role) can read published trips, their photos, and the
-- site settings. Only an admin can read drafts or change anything.

alter table public.trips           enable row level security;
alter table public.photos          enable row level security;
alter table public.photo_locations enable row level security;
alter table public.site_settings   enable row level security;

grant select on public.trips, public.photos, public.site_settings
  to anon, authenticated;
grant insert, update, delete on public.trips, public.photos
  to authenticated;
grant update on public.site_settings to authenticated;
grant select, insert, update, delete on public.photo_locations
  to authenticated;

-- trips
create policy "Published trips are public; admins see drafts too"
  on public.trips for select
  using (status = 'published' or (select public.is_admin()));

create policy "Admins create trips"
  on public.trips for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit trips"
  on public.trips for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete trips"
  on public.trips for delete to authenticated
  using ((select public.is_admin()));

-- photos
create policy "Photos of published trips are public; admins see all"
  on public.photos for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.trips t
      where t.id = photos.trip_id and t.status = 'published'
    )
  );

create policy "Admins add photos"
  on public.photos for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit photos"
  on public.photos for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete photos"
  on public.photos for delete to authenticated
  using ((select public.is_admin()));

-- photo_locations: admins only, for everything
create policy "Only admins touch photo locations"
  on public.photo_locations for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- site_settings
create policy "Site settings are public"
  on public.site_settings for select
  using (true);

create policy "Admins edit site settings"
  on public.site_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- One public bucket. "Public" means anyone with a file's URL can download it,
-- which is what a public photo site needs. Uploading, replacing, listing and
-- deleting are limited to admins by the policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  10485760, -- 10 MB per file; resized uploads are far smaller
  array['image/webp', 'image/jpeg']
)
on conflict (id) do nothing;

create policy "Admins list photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins upload photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins replace photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()))
  with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "Admins delete photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));
