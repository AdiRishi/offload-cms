import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { accounts } from "@/lib/accounts.server";
import { getVisitorPayload } from "@/lib/payload.server";

/** The customer's own bookings. The collection's read access limits the query to them. */
const getBookings = createServerFn({ method: "GET" }).handler(async () => {
  const [account, payload] = await Promise.all([accounts.requireAccount(), getVisitorPayload()]);
  const { docs } = await payload.find({
    collection: "bookings",
    depth: 0,
    overrideAccess: false,
    user: account,
    sort: "title",
  });
  return docs.map(({ id, title }) => ({ id, title }));
});

export const Route = createFileRoute("/_frontend/_account/account/bookings")({
  loader: () => getBookings(),
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Your bookings" }] }),
});

function BookingsPage() {
  const bookings = Route.useLoaderData();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Your bookings</h1>
      {bookings.length ? (
        <ul className="list-disc pl-6">
          {bookings.map((booking) => (
            <li key={booking.id}>{booking.title}</li>
          ))}
        </ul>
      ) : (
        <p>You have no bookings.</p>
      )}
    </main>
  );
}
