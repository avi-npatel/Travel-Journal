import type { MetadataRoute } from "next";
import { getPublishedTrips } from "@/lib/data";
import { siteUrl, tripPath } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const trips = await getPublishedTrips();

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/trips`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/map`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.4 },
    ...trips.map((trip) => ({
      url: `${base}${tripPath(trip)}`,
      lastModified: trip.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
