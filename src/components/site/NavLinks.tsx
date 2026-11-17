"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/lib/nav";

/** Main navigation. `pathname` is null while the server prerenders the shell. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "meta py-2 transition-colors hover:text-accent",
              active ? "text-accent underline decoration-1 underline-offset-[6px]" : "meta-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

/** Same links, highlighting whichever section is open. */
export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}
