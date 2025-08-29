import { createClient } from "@/lib/supabase/server";

export default async function DashboardServices() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id,name,slug,visible,sort_order")
    .order("sort_order");
  const { data: services } = await supabase
    .from("services")
    .select("id,name,slug,description,category_id,visible,draft,base_price_cents,base_duration_min")
    .order("name");

  async function addCategory(formData: FormData) {
    "use server";
    const supa = await createClient();
    const name = String(formData.get("name") || "");
    const slug = String(formData.get("slug") || "");
    await supa.from("service_categories").insert({ name, slug, visible: true });
  }

  async function updateService(formData: FormData) {
    "use server";
    const supa = await createClient();
    const id = String(formData.get("id"));
    const name = String(formData.get("name"));
    const description = String(formData.get("description") || "");
    const visible = formData.get("visible") === "on";
    const draft = formData.get("draft") === "on";
    const base_price_cents = Number(formData.get("base_price_cents") || 0);
    const base_duration_min = Number(formData.get("base_duration_min") || 0);
    await supa
      .from("services")
      .update({ name, description, visible, draft, base_price_cents, base_duration_min })
      .eq("id", id);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Services & Categories</h1>
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Categories</h2>
        <form action={addCategory} className="flex gap-2 mb-3">
          <input name="name" placeholder="Name" className="border rounded px-2 py-1" />
          <input name="slug" placeholder="slug" className="border rounded px-2 py-1" />
          <button className="underline" type="submit">Add</button>
        </form>
        <ul className="text-sm list-disc pl-5">
          {(categories ?? []).map((c) => (
            <li key={c.id}>{c.name} ({c.slug})</li>
          ))}
        </ul>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Services</h2>
        <div className="space-y-4">
          {(services ?? []).map((s) => (
            <form key={s.id} action={updateService} className="border rounded p-3 space-y-2">
              <input type="hidden" name="id" value={s.id} />
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Name</label>
                  <input name="name" defaultValue={s.name} className="border rounded px-2 py-1 w-full" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Base price (cents)</label>
                  <input name="base_price_cents" type="number" defaultValue={s.base_price_cents ?? 0} className="border rounded px-2 py-1 w-full" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Base duration (min)</label>
                  <input name="base_duration_min" type="number" defaultValue={s.base_duration_min ?? 0} className="border rounded px-2 py-1 w-full" />
                </div>
                <div className="flex items-center gap-4 mt-5">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name="visible" defaultChecked={!!s.visible} /> visible
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name="draft" defaultChecked={!!s.draft} /> draft
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1">Description</label>
                <textarea name="description" defaultValue={s.description ?? ""} className="border rounded px-2 py-1 w-full" />
              </div>
              <button type="submit" className="underline">Save</button>
            </form>
          ))}
          {(!services || services.length === 0) && <div>No services yet.</div>}
        </div>
      </section>
    </div>
  );
}


