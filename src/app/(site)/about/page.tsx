import type { Metadata } from "next";
import { StatsStrip } from "@/components/site/StatsStrip";
import { getPublishedTrips, getSettings } from "@/lib/data";
import { formatCoordinates, homePoint } from "@/lib/geo";
import { computeStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const [trips, settings] = await Promise.all([getPublishedTrips(), getSettings()]);

  return (
    <div className="shell pt-12 sm:pt-20">
      <h1 className="display text-[clamp(3.25rem,10vw,9rem)]">About</h1>

      <div className="mt-10 grid gap-x-12 gap-y-10 sm:mt-16 lg:grid-cols-12">
        {settings.about_html ? (
          <div
            className="prose-journal lg:col-span-7"
            // Written in /admin → Settings; sanitised in lib/data.ts.
            dangerouslySetInnerHTML={{ __html: settings.about_html }}
          />
        ) : (
          <p className="display text-3xl text-muted lg:col-span-7">Nothing written here yet.</p>
        )}

        <dl className="space-y-5 lg:col-span-4 lg:col-start-9">
          <div>
            <dt className="meta border-b border-rule pb-2">Home base</dt>
            <dd className="mt-3 font-display text-xl">{settings.home_name}</dd>
            <dd className="meta mt-1">{formatCoordinates(homePoint(settings))}</dd>
          </div>
        </dl>
      </div>

      <section aria-label="Totals" className="mt-16 sm:mt-24">
        <StatsStrip stats={computeStats(trips, settings)} />
      </section>
    </div>
  );
}
