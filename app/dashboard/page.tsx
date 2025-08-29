import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverview() {
  const supabase = await createClient();
  const [{ count: bookingsToday }, { count: clientsCount }] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).gte("start_at", new Date().toISOString()),
    supabase.from("clients").select("id", { count: "exact", head: true }),
  ]);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Overview</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded p-4"><div className="text-sm">Bookings (from now)</div><div className="text-2xl font-semibold">{bookingsToday ?? 0}</div></div>
        <div className="border rounded p-4"><div className="text-sm">Clients</div><div className="text-2xl font-semibold">{clientsCount ?? 0}</div></div>
      </div>
    </div>
  );
}


