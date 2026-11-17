// The picture shown when a trip's link is shared (Open Graph / social cards).
// Next.js serves it at /trips/<slug>/opengraph-image and adds the meta tags.
//
// With a cover photo: the photo, darkened, with the title over it.
// Without one: a typographic card on paper, like the trip's boarding pass.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { countryNames } from "@/lib/countries";
import { getSettings, getTripBySlug } from "@/lib/data";
import { formatTripDates } from "@/lib/dates";
import { photoUrl } from "@/lib/images";

export const alt = "Trip cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f4efe6";
const INK = "#17140f";
const ACCENT = "#be2f16";

// Fonts for the card are read from disk: the image is drawn on the server,
// where the site's web fonts are not available.
const font = (file: string) => readFile(join(process.cwd(), "assets/og", file));

/**
 * Downloads a photo and returns it as a JPEG data URL, cropped to the card.
 * Photos are stored as WebP, which the card renderer cannot draw, so it is
 * converted here. If anything fails the card falls back to the version
 * without a photo: a link preview never breaks over one image.
 */
async function coverForCard(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(size.width, size.height, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function TripOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [trip, settings, fraunces, plexMono] = await Promise.all([
    getTripBySlug(slug),
    getSettings(),
    font("Fraunces-Medium.woff"),
    font("IBMPlexMono-Medium.woff"),
  ]);

  const title = trip?.title ?? settings.site_title;
  const countries = trip ? countryNames(trip.country_codes).join(", ") : "";
  const details = [trip && formatTripDates(trip), countries].filter(Boolean).join("  ·  ");
  const route = trip?.country_codes.length
    ? `${settings.home_code}  →  ${trip.country_codes.slice(0, 2).join(" · ")}`
    : "";
  // The medium size is plenty for a 1200px card.
  const cover = trip?.cover ? await coverForCard(photoUrl(trip.cover, "md")) : null;
  const onPhoto = cover !== null;
  const foreground = onPhoto ? "#ffffff" : INK;

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        background: onPhoto ? "#0b0b0c" : PAPER,
        color: foreground,
        fontFamily: "Plex Mono",
      }}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
      )}
      {cover && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.2))",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, letterSpacing: 3 }}>
          <span>{settings.site_title.toUpperCase()}</span>
          <span style={{ color: onPhoto ? "#ffffff" : ACCENT }}>{route}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontSize: title.length > 28 ? 84 : 118,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              paddingTop: 22,
              borderTop: `2px solid ${foreground}`,
              fontSize: 24,
              letterSpacing: 3,
            }}
          >
            {details.toUpperCase()}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 500, style: "normal" },
        { name: "Plex Mono", data: plexMono, weight: 500, style: "normal" },
      ],
    },
  );
}
