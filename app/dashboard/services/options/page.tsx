import { createClient } from "@/lib/supabase/server";

export default async function ServiceOptionsAdmin() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id,name")
    .order("name");
  const { data: options } = await supabase
    .from("service_options")
    .select("id,service_id,name,price_delta_cents,duration_delta_min,visible,sort_order")
    .order("sort_order");
  const serviceMap = new Map((services ?? []).map((s) => [s.id, s.name]));

  async function updateOption(formData: FormData) {
    "use server";
    const supa = await createClient();
    const id = String(formData.get("id"));
    const name = String(formData.get("name"));
    const price_delta_cents = Number(formData.get("price_delta_cents") || 0);
    const duration_delta_min = Number(formData.get("duration_delta_min") || 0);
    const sort_order = Number(formData.get("sort_order") || 0);
    const visible = formData.get("visible") === "on";
    await supa
      .from("service_options")
      .update({ name, price_delta_cents, duration_delta_min, sort_order, visible })
      .eq("id", id);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Service Options</h1>
      <div className="space-y-3">
        {(options ?? []).map((o) => (
          <form key={o.id} action={updateOption} className="border rounded p-3 grid md:grid-cols-5 gap-2">
            <input type="hidden" name="id" value={o.id} />
            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">{serviceMap.get(o.service_id) ?? "Service"}</div>
              <input name="name" defaultValue={o.name} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Price Δ</label>
              <input name="price_delta_cents" type="number" defaultValue={o.price_delta_cents ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Duration Δ</label>
              <input name="duration_delta_min" type="number" defaultValue={o.duration_delta_min ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Order</label>
              <input name="sort_order" type="number" defaultValue={o.sort_order ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div className="col-span-full flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="visible" defaultChecked={!!o.visible} /> visible
              </label>
              <button type="submit" className="underline">Save</button>
            </div>
          </form>
        ))}
        {(!options || options.length === 0) && <div>No options yet.</div>}
      </div>
    </div>
  );
}


