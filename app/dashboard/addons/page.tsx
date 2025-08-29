import { createClient } from "@/lib/supabase/server";

export default async function AddonsAdmin() {
  const supabase = await createClient();
  const { data: addons } = await supabase
    .from("addons")
    .select("id,name,slug,price_delta_cents,duration_delta_min,visible")
    .order("name");

  async function updateAddon(formData: FormData) {
    "use server";
    const supa = await createClient();
    const id = String(formData.get("id"));
    const name = String(formData.get("name"));
    const price_delta_cents = Number(formData.get("price_delta_cents") || 0);
    const duration_delta_min = Number(formData.get("duration_delta_min") || 0);
    const visible = formData.get("visible") === "on";
    await supa
      .from("addons")
      .update({ name, price_delta_cents, duration_delta_min, visible })
      .eq("id", id);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Add-ons</h1>
      <div className="space-y-3">
        {(addons ?? []).map((a) => (
          <form key={a.id} action={updateAddon} className="border rounded p-3 grid md:grid-cols-3 gap-2">
            <input type="hidden" name="id" value={a.id} />
            <div>
              <label className="block text-xs mb-1">Name</label>
              <input name="name" defaultValue={a.name} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Price Δ (cents)</label>
              <input name="price_delta_cents" type="number" defaultValue={a.price_delta_cents ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Duration Δ (min)</label>
              <input name="duration_delta_min" type="number" defaultValue={a.duration_delta_min ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div className="col-span-full flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="visible" defaultChecked={!!a.visible} /> visible
              </label>
              <button type="submit" className="underline">Save</button>
            </div>
          </form>
        ))}
        {(!addons || addons.length === 0) && <div>No add-ons yet.</div>}
      </div>
    </div>
  );
}


