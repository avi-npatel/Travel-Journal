import Link from "next/link";
import { Suspense } from "react";
import { ActiveNavLinks, NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ siteTitle }: { siteTitle: string }) {
  return (
    <header className="border-b border-rule">
      <a
        href="#main"
        className="btn btn-primary sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-3 focus-visible:z-50"
      >
        Skip to content
      </a>
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="display text-[1.6rem] leading-none hover:text-accent">
          {siteTitle}
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <nav aria-label="Main" className="flex items-center gap-4 sm:gap-8">
            {/* The current path is only known per request, so the highlighted
                version streams in over the plain links. */}
            <Suspense fallback={<NavLinks pathname={null} />}>
              <ActiveNavLinks />
            </Suspense>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
