# Logbook

A personal travel journal: trips, photographs, and a map of where they were taken.

Everything on the public site comes from a database you manage at `/admin`. Adding a trip, uploading
photos, or rewriting the About page never involves code or a redeploy.

- **Next.js 16** (App Router, TypeScript) and **Tailwind CSS 4**
- **Supabase** for the database (Postgres), photo storage, and sign-in
- Runs on the free tiers of **Vercel** and **Supabase**

## Contents

1. [Set it up](#set-it-up) (about 20 minutes, once)
2. [Using the admin](#using-the-admin)
3. [How it works](#how-it-works)
4. [Free-tier limits worth knowing](#free-tier-limits-worth-knowing)
5. [Project layout](#project-layout)
6. [Commands](#commands)
7. [If something goes wrong](#if-something-goes-wrong)

---

## Set it up

You need [Node.js](https://nodejs.org) 20 or newer, a free [Supabase](https://supabase.com) account,
and (to put it online) free [GitHub](https://github.com) and [Vercel](https://vercel.com) accounts.

> Supabase rearranges its dashboard from time to time. If a menu is not exactly where these steps say,
> the names of the things you are looking for (SQL Editor, Users, API keys) stay the same.

### 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) and choose **New project**.
2. Give it a name, let it generate a **database password** (save it in a password manager; this site
   never needs it), pick the **region** closest to you, and create the project.
3. Wait a minute or two until the project finishes setting up.

### 2. Create the tables, security rules, and photo bucket

1. In the project's left sidebar open **SQL Editor** and start a **new query**.
2. Open [`supabase/migrations/20261117000000_init.sql`](supabase/migrations/20261117000000_init.sql)
   from this folder, copy all of it, paste it into the editor, and press **Run**. You should see
   "Success. No rows returned."
3. Start another new query, paste the contents of [`supabase/seed.sql`](supabase/seed.sql), and
   **Run** it. This adds the four starter trips (Tromso, Chicago, Lisbon/Sintra/Algarve, Edinburgh).

That first file creates everything: the `trips`, `photos` and `site_settings` tables, the rules that
let visitors read only published trips, and the public `photos` storage bucket that only an admin
can upload to. It is commented throughout if you want to read what it does.

### 3. Create your admin account

1. In the sidebar open **Authentication → Users**, choose **Add user → Create new user**, enter your
   email and a strong password, tick **Auto Confirm User**, and create it.
2. Back in the **SQL Editor**, run this with your own email:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   It should report one row inserted. That row is what makes the account an admin.

3. Stop anyone else from registering: **Authentication → Sign In / Providers**, turn **off**
   "Allow new users to sign up", and save.

Even if step 3 were skipped, a stranger who signed up could do nothing: only accounts listed in the
`admins` table can see drafts or change anything. Turning sign-ups off just keeps the user list tidy.

### 4. Connect the site to your project

1. Copy `.env.example` to a new file named `.env.local` (replace the one that is there).
2. Fill in two values from the Supabase dashboard (the **Connect** button at the top of the project
   shows both, as does **Project Settings**):
   - `NEXT_PUBLIC_SUPABASE_URL`: the **Project URL**, like `https://abcdefgh.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the **Publishable key**, starting `sb_publishable_`
     (the older "anon" key also works)

Both are meant to be public. What a visitor can do with them is limited by the security rules from
step 2. Never put the **secret** / **service_role** key in this project; it is not needed.

### 5. Run it on your computer

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000> for the site and <http://localhost:3000/admin> to sign in.

### 6. Put it online with Vercel

1. Put the project on GitHub. From this folder:

   ```bash
   git init
   ```

   ```bash
   git add -A
   ```

   ```bash
   git commit -m "Travel journal"
   ```

   Then create an empty repository on GitHub and run the two "push an existing repository" commands
   GitHub shows you.

2. At [vercel.com/new](https://vercel.com/new) import that repository. Vercel recognises Next.js; leave
   the build settings alone.
3. Before deploying, open **Environment Variables** and add the same two values as in `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy. Your site is live at the address Vercel gives you; the admin is at `/admin`.

If you later add your own domain, also set `NEXT_PUBLIC_SITE_URL` (for example
`https://example.com`) in Vercel so link previews point at it, and redeploy once.

From here on you only redeploy to change the code. Content changes are live the moment you save them.

---

## Using the admin

Go to `/admin` and sign in.

**New trip.** Press **New trip**. A draft is created straight away, so you can drop photos in before
filling anything else out. Only the title is required. Drafts are visible only in the admin.

**Details.** Title, countries (type to search, add several), cities or places, dates, tags, a short
summary, and a longer description with bold, italics, headings, lists, quotes and links. Tick
"I only know the month" for trips you remember as "March 2025". Press **Save**; set **Visibility** to
Published when it should appear on the site.

**Photos.** Drag files onto the drop area, as many at once as you like. Each one is resized in your
browser (2400px on the long edge, plus two smaller sizes), has all location data removed, and is then
uploaded with its own progress bar. After that:

- drag a photo to reorder it (or focus it and use space, arrow keys, space)
- type a caption under it; it saves when you leave the field and becomes the photo's alt text
- **Make cover** picks the trip's cover; the first photo is the cover until you choose
- **Delete** removes the photo and its files

Photo changes save on their own. Only the details form uses the Save button.

**Dates and location from your photos.** If the photos carry a date or GPS position, a box offers to
fill in the trip's dates, map pin, and country. The pin is rounded to about 10 km. Exact photo
positions are stored privately and shown only to you, as grey dots on the pin map.

**Map pin.** Search for a place, click the map, or drag the pin. Without a pin, the trip sits in the
middle of its first country.

**Settings.** Site name and description, the About page, your home base (routes and distances are
measured from it; Charlotte by default), and **Other countries visited**: countries you have been
to but have not written up yet. They are filled in on the maps and counted in the totals, so the map
can show all of your countries from day one.

**Deleting a trip** (bottom of its page) removes the trip, its photos, and their files for good.

---

## How it works

**Pages are cached, and the admin clears the cache.** Every public page is built from the database
and then cached, so visitors never wait on a query ([`src/lib/data.ts`](src/lib/data.ts)). When you
save something in `/admin`, it calls a small server action
([`src/app/admin/actions.ts`](src/app/admin/actions.ts)) that throws the cache away. The next visitor
gets freshly built pages. That is how changes appear immediately with no redeploy.

**Security is in the database.** The admin screens run in your browser and talk to Supabase as you.
The rules in the migration file ("row level security") decide what is allowed: anyone can read
published trips; only accounts in the `admins` table can read drafts or write anything. Hiding the
admin UI is a convenience. The database is the lock.

**Photos are prepared in the browser.** [`src/lib/admin/process-image.ts`](src/lib/admin/process-image.ts)
draws each photo onto a canvas and saves three WebP files (JPEG where a browser cannot write WebP).
Saving from a canvas keeps pixels only, which is what strips EXIF and GPS data. `next/image` then
picks whichever stored size fits the layout
([`src/lib/image-loader.ts`](src/lib/image-loader.ts)) instead of using Vercel's metered image
optimiser, and shows a blurred preview while the file loads.

**Maps need no API key.** The home page map and the globe covers are plain SVG drawn on the server.
The interactive map is MapLibre drawing country outlines from a file in `public/geo`. There are no
map tiles and no third-party map service. (The place search in the admin's pin picker does call
OpenStreetMap's free search.)

**Stats are counted, never typed in.** Countries, continents, trips and photos are worked out from
the published trips plus the "other countries" list ([`src/lib/stats.ts`](src/lib/stats.ts)).

---

## Free-tier limits worth knowing

These are the providers' limits as of writing; check their pricing pages for current numbers.

- **Supabase storage is about 1 GB on the free plan.** A photo takes roughly 0.6 to 1.3 MB across
  its three sizes, so expect room for somewhere around 800 to 1,500 photos before needing a paid plan.
- **Supabase pauses free projects after about a week with no activity.** A paused project makes the
  site show its "could not be loaded" page once cached pages expire. Open the Supabase dashboard and
  press **Restore** to bring it back; nothing is lost. Regular visits and admin use keep it active.
- **HEIC photos** (the iPhone default) can only be read by Safari. In other browsers, export as JPEG
  first, or set the phone's camera format to "Most Compatible".

---

## Project layout

```
supabase/
  migrations/…_init.sql   tables, security rules, storage bucket (run once)
  seed.sql                the four starter trips
src/
  app/
    (site)/               public pages: home, trips, trip, map, about
    admin/                sign-in, trip list, trip editor, settings
  components/
    site/                 header, maps, gallery, lightbox, boarding pass…
    admin/                trip editor, photo uploader, country picker…
  lib/
    data.ts               every database read the public site makes
    admin/                database writes, image processing, EXIF, uploads
    map/                  map helpers
    supabase/             the three ways the app connects to Supabase
  data/countries.json     country names, continents, centre points
public/geo/               country outlines for the interactive map
scripts/                  small build helpers (see comments in each)
```

Design tokens (colours for both themes, fonts) are at the top of
[`src/app/globals.css`](src/app/globals.css).

---

## Commands

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Run the site locally with live reload            |
| `npm run build`     | Build for production (Vercel runs this for you)  |
| `npm run start`     | Serve the production build locally               |
| `npm run lint`      | Check the code with ESLint                       |
| `npm run typecheck` | Check types                                      |
| `npm run format`    | Format the code with Prettier                    |
| `npm run geo:build` | Regenerate country data (only after updating it) |

### Optional: a local Supabase for development

If you have Docker Desktop, you can run Supabase on your own machine instead of using the hosted
project while developing:

```bash
npx supabase start
```

It applies the migration and the seed file by itself and prints a local URL and publishable key to
put in `.env.local`. Its dashboard (Studio) runs at the address it prints; create your user and add
it to `admins` there exactly as in step 3. `npx supabase stop` shuts it down. The ports in
`supabase/config.toml` are set to the 553xx range because Windows often reserves the default ones.

---

## If something goes wrong

- **"Supabase is not configured"**: `.env.local` is missing or a value is blank. Restart
  `npm run dev` after editing it.
- **"Not an admin account" after signing in**: the SQL in step 3.2 has not been run for that email.
- **Upload fails with a permissions message**: same cause; the account is not in `admins`.
- **The site shows "Delayed on arrival"**: the database could not be reached. Most often the free
  Supabase project has paused (see above).
- **A change is not showing**: reload the page. Every save in the admin refreshes the public site, and
  as a backstop the site rebuilds its pages from the database at least once an hour.
