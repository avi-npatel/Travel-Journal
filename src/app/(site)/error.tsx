"use client";

// Shown if a public page fails to load, most likely because the database
// could not be reached. Error boundaries must be Client Components.

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="shell py-24 sm:py-36">
      <p className="meta">Something went wrong</p>
      <h1 className="display mt-4 text-[clamp(3rem,10vw,8rem)]">
        Delayed <em>on arrival</em>
      </h1>
      <p className="mt-6 max-w-md text-soft">
        This page could not be loaded just now. It is usually temporary.
      </p>
      <button type="button" className="btn btn-primary mt-8" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
