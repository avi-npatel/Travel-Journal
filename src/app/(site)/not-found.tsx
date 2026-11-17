import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell py-24 sm:py-36">
      <p className="meta">Error 404 · No such page</p>
      <h1 className="display mt-4 text-[clamp(3rem,10vw,8rem)]">
        Off the <em>map</em>
      </h1>
      <p className="mt-6 max-w-md text-soft">
        This page does not exist, or the trip it pointed to is no longer published.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/trips" className="btn btn-primary">
          All trips
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
