/**
 * Runs `worker` over every item, at most `limit` at a time. Resizing and
 * uploading thirty photos at once would exhaust memory and choke the
 * connection; a few in parallel is faster than one by one and stays smooth.
 *
 * `worker` should handle its own errors: one that throws stops its lane.
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
