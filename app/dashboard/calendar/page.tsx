import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: upcoming } = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,services(name),service_options(name),clients(first_name,last_name)")
    .gte("start_at", new Date().toISOString())
    .order("start_at");

  type NameObj = { name?: string };
  type PersonObj = { first_name?: string; last_name?: string };
  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    services: NameObj | NameObj[] | null;
    service_options: NameObj | NameObj[] | null;
    clients: PersonObj | PersonObj[] | null;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Calendar</h1>
      <div className="space-y-2">
        {(upcoming ?? []).map((row => {
          const a = row as unknown as Row;
          const svcName = Array.isArray(a.services) ? a.services[0]?.name : a.services?.name;
          const optName = Array.isArray(a.service_options) ? a.service_options[0]?.name : a.service_options?.name;
          const person = Array.isArray(a.clients) ? a.clients[0] : a.clients;
          const first = person?.first_name ?? "";
          const last = person?.last_name ?? "";
          return (
          <div key={a.id} className="border rounded p-3">
            <div className="font-medium">
              {new Date(a.start_at).toLocaleString()} — {first} {last}
            </div>
            <div className="text-sm">{svcName}{optName ? ` • ${optName}` : ""}</div>
            <div className="text-xs">{a.status}</div>
          </div>
          );
        }))}
        {(!upcoming || upcoming.length === 0) && <div>No upcoming appointments.</div>}
      </div>
    </div>
  );
}


