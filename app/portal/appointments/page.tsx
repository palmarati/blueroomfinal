import { createClient } from "@/lib/supabase/server";

export default async function PortalAppointments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Please login.</div>;
  }
  await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
  const { data: appts } = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,services(name),service_options(name)")
    .order("start_at", { ascending: false });

  async function cancelAppointment(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const supa = await createClient();
    // RLS permits client to update their own appointment
    await supa.from("appointments").update({ status: "cancelled" }).eq("id", id);
  }

  return (
    <div className="space-y-3">
      {(appts ?? []).map((row) => {
        type NameObj = { name?: string };
        const a = row as unknown as {
          id: string;
          start_at: string;
          end_at: string;
          status: string;
          services: NameObj | NameObj[] | null;
          service_options: NameObj | NameObj[] | null;
        };
        const svcName = Array.isArray(a.services) ? a.services[0]?.name : a.services?.name;
        const optName = Array.isArray(a.service_options) ? a.service_options[0]?.name : a.service_options?.name;
        return (
          <div key={a.id} className="border rounded p-3">
            <div className="font-medium">{svcName}{optName ? ` • ${optName}` : ""}</div>
            <div className="text-sm">{new Date(a.start_at).toLocaleString()} → {new Date(a.end_at).toLocaleString()}</div>
            <div className="text-xs mb-2">Status: {a.status}</div>
            {a.status === "approved" || a.status === "requested" ? (
              <form action={cancelAppointment}>
                <input type="hidden" name="id" value={a.id} />
                <button className="underline" type="submit">Cancel</button>
              </form>
            ) : null}
          </div>
        );
      })}
      {(!appts || appts.length === 0) && <div>No appointments yet.</div>}
    </div>
  );
}


