import { createClient } from "@/lib/supabase/server";

export default async function PortalProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Please login.</div>;
  const { data: client } = await supabase
    .from("clients")
    .select("id,first_name,last_name,email,phone,notes")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: paymentMethods } = await supabase
    .from("payment_methods")
    .select("id,brand,last4,exp_month,exp_year,square_card_id")
    .eq("client_id", client?.id ?? "")
    .order("created_at", { ascending: false });

  async function saveProfile(formData: FormData) {
    "use server";
    const supa = await createClient();
    const { data: { user: u } } = await supa.auth.getUser();
    if (!u) return;
    const first_name = String(formData.get("first_name") || "");
    const last_name = String(formData.get("last_name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const notes = String(formData.get("notes") || "");
    const { data: c } = await supa.from("clients").select("id,email").eq("user_id", u.id).maybeSingle();
    if (!c?.id) return;
    await supa.from("clients").update({ first_name, last_name, phone, notes, email }).eq("id", c.id);
    if (email && email !== c.email) {
      await supa.auth.updateUser({ email });
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold mb-2">Profile</h2>
      <form action={saveProfile} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">First name</label>
          <input name="first_name" defaultValue={client?.first_name ?? ""} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Last name</label>
          <input name="last_name" defaultValue={client?.last_name ?? ""} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input name="email" defaultValue={client?.email ?? ""} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Phone</label>
          <input name="phone" defaultValue={client?.phone ?? ""} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Notes</label>
          <textarea name="notes" defaultValue={client?.notes ?? ""} className="border rounded px-3 py-2 w-full" />
        </div>
        <button type="submit" className="underline">Save</button>
      </form>
      <div className="mt-8">
        <h3 className="font-semibold mb-2">Payment Methods</h3>
        <AddCardClient />
        <div className="mt-3 space-y-2">
          {(paymentMethods ?? []).length === 0 && <div className="text-sm text-muted-foreground">No saved cards.</div>}
          {(paymentMethods ?? []).map((pm) => (
            <form key={pm.id} action={async () => {
              "use server";
              await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/square/delete-card`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: pm.square_card_id }) });
            }}>
              <div className="flex items-center justify-between border rounded p-2 text-sm">
                <div>{pm.brand ?? "Card"} •••• {pm.last4} {pm.exp_month && pm.exp_year ? `(exp ${pm.exp_month}/${pm.exp_year})` : ""}</div>
                <button type="submit" className="underline">Remove</button>
              </div>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}


function AddCardClient() {
  // Placeholder replaced by dynamic import client-side
  return null as any;
}

