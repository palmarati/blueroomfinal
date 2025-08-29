import { createClient } from "@/lib/supabase/server";
import ServiceManagerClient from "./service-manager-client";

export default async function DashboardServices() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id,name,slug,visible,sort_order")
    .order("sort_order");
  const { data: servicesRaw } = await supabase
    .from("services")
    .select("id,name,description,category_id,visible,draft,base_price_cents,base_duration_min,deposit_cents,image_url,color")
    .order("name");
  const services = servicesRaw ?? [];

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
    const base_price_dollars = parseFloat(String(formData.get("base_price_dollars") || "0"));
    const base_price_cents = Math.round((isNaN(base_price_dollars) ? 0 : base_price_dollars) * 100);
    const base_duration_min = Number(formData.get("base_duration_min") || 0);
    const deposit_dollars = parseFloat(String(formData.get("deposit_dollars") || "0"));
    const deposit_cents = Math.round((isNaN(deposit_dollars) ? 0 : deposit_dollars) * 100);
    const category_id = String(formData.get("category_id") || "") || null;
    const image_url = String(formData.get("image_url") || "") || null;
    const color = String(formData.get("color") || "") || null;
    await supa
      .from("services")
      .update({ name, description, visible, draft, base_price_cents, base_duration_min, deposit_cents, category_id, image_url, color })
      .eq("id", id);
  }

  async function createService(formData: FormData) {
    "use server";
    const supa = await createClient();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "");
    const category_id = String(formData.get("category_id") || "") || null;
    const visible = formData.get("visible") === "on";
    const draft = formData.get("draft") === "on";
    const image_url = String(formData.get("image_url") || "") || null;
    const color = String(formData.get("color") || "") || null;
    const base_price_dollars = parseFloat(String(formData.get("base_price_dollars") || "0"));
    const base_price_cents = Math.round((isNaN(base_price_dollars) ? 0 : base_price_dollars) * 100);
    const base_duration_min = Number(formData.get("base_duration_min") || 0);
    const deposit_dollars = parseFloat(String(formData.get("deposit_dollars") || "0"));
    const deposit_cents = Math.round((isNaN(deposit_dollars) ? 0 : deposit_dollars) * 100);
    const raw = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    let slug = raw || `service-${Date.now()}`;
    let attempts = 0;
    while (attempts < 3) {
      const { error } = await supa
        .from("services")
        .insert({ name, slug, description, category_id, visible, draft, base_price_cents, base_duration_min, deposit_cents, image_url, color });
      if (!error) break;
      if ((error.message || "").toLowerCase().includes("duplicate")) { slug = `${raw}-${Math.floor(Math.random()*1000)}`; attempts++; continue; }
      break;
    }
    // Handle options arrays if provided
    const names = formData.getAll("option_name[]").map(String).filter(Boolean);
    const prices = formData.getAll("option_price_dollars[]").map((s) => Math.round((parseFloat(String(s)||"0")||0)*100));
    const durations = formData.getAll("option_duration_min[]").map((s) => Number(String(s)||0));
    const buffers = formData.getAll("option_processing_min[]").map((s) => Number(String(s)||0));
    const deposits = formData.getAll("option_deposit_dollars[]").map((s) => Math.round((parseFloat(String(s)||"0")||0)*100));
    if (names.length > 0) {
      const { data: svc } = await supa.from("services").select("id").eq("slug", slug).maybeSingle();
      if (svc?.id) {
        const rows = names.slice(0,10).map((n, i) => ({ service_id: svc.id, name: n, price_delta_cents: prices[i]||0, duration_delta_min: durations[i]||0, sort_order: i, visible: true }));
        await supa.from("service_options").insert(rows);
      }
    }
  }

  async function deleteService(formData: FormData) {
    "use server";
    const supa = await createClient();
    const id = String(formData.get("id"));
    await supa.from("services").delete().eq("id", id);
  }

  async function addService(formData: FormData) {
    "use server";
    const supa = await createClient();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "");
    const category_id = String(formData.get("category_id") || "") || null;
    const visible = formData.get("visible") === "on";
    const draft = formData.get("draft") === "on";
    const base_price_cents = Number(formData.get("base_price_cents") || 0);
    const base_duration_min = Number(formData.get("base_duration_min") || 0);
    if (!name) return;
    const raw = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    let slug = raw || `service-${Date.now()}`;
    let attempts = 0;
    while (attempts < 3) {
      const { error } = await supa
        .from("services")
        .insert({ name, slug, description, category_id, visible, draft, base_price_cents, base_duration_min });
      if (!error) break;
      if ((error.message || "").toLowerCase().includes("duplicate")) {
        slug = `${raw}-${Math.floor(Math.random() * 1000)}`;
        attempts++;
        continue;
      }
      break;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Services & Categories</h1>
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Add New Service</h2>
        <form action={addService} className="grid md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1">Name</label>
            <input name="name" placeholder="Service name" className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Category</label>
            <select name="category_id" className="border rounded px-2 py-1 w-full">
              <option value="">None</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Base price (cents)</label>
            <input name="base_price_cents" type="number" placeholder="0" className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Base duration (min)</label>
            <input name="base_duration_min" type="number" placeholder="60" className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="flex items-center gap-4 mt-5">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="visible" defaultChecked /> visible
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="draft" /> draft
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs mb-1">Description</label>
            <textarea name="description" placeholder="Description" className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="md:col-span-2"><button type="submit" className="underline">Create Service</button></div>
        </form>
      </section>
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
        <ServiceManagerClient
          categories={(categories ?? [])}
          services={(services ?? []).map((s) => ({ ...s, optionsCount: 0, categoryName: (categories ?? []).find((c) => c.id === s.category_id)?.name }))}
          onCreate={createService}
          onUpdate={updateService}
          onDelete={deleteService}
        />
      </section>
    </div>
  );
}


