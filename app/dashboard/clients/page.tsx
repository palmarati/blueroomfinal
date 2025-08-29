import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id,first_name,last_name,email,phone,user_id")
    .order("last_name", { ascending: true });

  async function saveClient(formData: FormData) {
    "use server";
    const supa = await createClient();
    const admin = createAdminClient();
    const id = String(formData.get("id"));
    const first_name = String(formData.get("first_name") || "");
    const last_name = String(formData.get("last_name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");

    const { data: existing } = await supa.from("clients").select("id,email,user_id").eq("id", id).maybeSingle();
    if (!existing?.id) return;
    await supa.from("clients").update({ first_name, last_name, email, phone }).eq("id", id);
    if (existing.user_id && email && email !== existing.email) {
      await admin.auth.admin.updateUserById(existing.user_id, { email });
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clients</h1>
      <div className="space-y-3">
        {(clients ?? []).map((c) => (
          <form action={saveClient} key={c.id} className="border rounded p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
            <input type="hidden" name="id" defaultValue={c.id} />
            <div>
              <label className="block text-xs mb-1">First name</label>
              <input name="first_name" defaultValue={c.first_name ?? ""} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Last name</label>
              <input name="last_name" defaultValue={c.last_name ?? ""} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Email</label>
              <input name="email" defaultValue={c.email ?? ""} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Phone</label>
              <input name="phone" defaultValue={c.phone ?? ""} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <button type="submit" className="text-sm underline">Save</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}


