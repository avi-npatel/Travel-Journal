import Link from "next/link";
import { formatCoordinates, homePoint } from "@/lib/geo";
import type { SiteSettings } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/nav";

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="shell flex flex-col gap-8 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="display text-2xl">{settings.site_title}</p>
          <p className="meta mt-3">
            Based in {settings.home_name}
            <span aria-hidden="true"> · </span>
            <span className="whitespace-nowrap">{formatCoordinates(homePoint(settings))}</span>
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href} className="meta meta-ink hover:text-accent">
              {label}
            </Link>
          ))}
          <Link href="/admin" className="meta hover:text-accent" prefetch={false}>
            Admin
          </Link>
        </nav>
      </div>
      <div className="shell pb-8">
        <p className="meta">Country outlines: Natural Earth.</p>
      </div>
    </footer>
  );
}
