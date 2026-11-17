import { Suspense } from "react";
import { TripEditor } from "@/components/admin/TripEditor";

/**
 * Edit one trip. The id in the URL is only known per request, so it is read
 * inside <Suspense>; the editor then loads the trip in the browser, as the
 * signed-in admin.
 */
export default function EditTripPage({ params }: PageProps<"/admin/trips/[id]">) {
  return (
    <Suspense fallback={<p className="meta">Loading trip…</p>}>
      {params.then(({ id }) => (
        // `key` gives each trip a fresh editor rather than reusing one's state.
        <TripEditor key={id} tripId={id} />
      ))}
    </Suspense>
  );
}
