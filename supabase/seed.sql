-- Starter trips. Title, country, month, and a city-level map pin only.
-- Descriptions and photos are left empty on purpose; add them in /admin.
--
-- date_precision = 'month' because only the month of each trip is recorded
-- here. Edit a trip in /admin to set exact start and end dates.

insert into public.trips
  (slug, title, status, country_codes, places, start_date, date_precision, lat, lng)
values
  ('tromso-2026', 'Tromso', 'published',
   '{NO}', '{Tromso}', '2026-03-01', 'month', 69.65, 18.96),

  ('chicago-2025', 'Chicago', 'published',
   '{US}', '{"Chicago, Illinois"}', '2025-10-01', 'month', 41.88, -87.63),

  ('lisbon-sintra-and-the-algarve-2025', 'Lisbon, Sintra, and the Algarve', 'published',
   '{PT}', '{Lisbon,Sintra,"The Algarve"}', '2025-03-01', 'month', 38.72, -9.14),

  ('edinburgh-2024', 'Edinburgh', 'published',
   '{GB}', '{"Edinburgh, Scotland"}', '2024-12-01', 'month', 55.95, -3.19)
on conflict (slug) do nothing;

-- Give each starter trip its place, with the pin above on it.
insert into public.trip_places (trip_id, name, sort_order, lat, lng, show_route)
select t.id, p.name, p.position - 1,
       case when p.position = 1 then t.lat end,
       case when p.position = 1 then t.lng end,
       true
from public.trips t
cross join lateral unnest(t.places) with ordinality as p(name, position)
where t.slug in ('tromso-2026', 'chicago-2025', 'lisbon-sintra-and-the-algarve-2025', 'edinburgh-2024')
  and not exists (select 1 from public.trip_places tp where tp.trip_id = t.id);
