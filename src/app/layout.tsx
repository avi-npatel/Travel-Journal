import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { ThemeScript } from "@/components/site/ThemeScript";
import { getSettings } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Headlines: a sharp, high-contrast serif with a real italic.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

// Body text.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

// Dates, coordinates, labels.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const DEFAULT_DESCRIPTION =
  "A personal travel journal: trips, photographs, and a map of where they were taken.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = settings.site_description || DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: settings.site_title, template: `%s · ${settings.site_title}` },
    description,
    openGraph: {
      type: "website",
      siteName: settings.site_title,
      title: settings.site_title,
      description,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script changes data-theme before React loads, which is
    // expected, so the mismatch warning is silenced for this one element.
    <html
      lang="en"
      className={`${fraunces.variable} ${schibsted.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
