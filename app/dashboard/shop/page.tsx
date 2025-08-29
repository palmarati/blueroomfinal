import { createClient } from "@/lib/supabase/server";

export default async function ShopAdminPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,slug,price_cents,visible,affiliate_url,in_house")
    .order("name");

  async function updateProduct(formData: FormData) {
    "use server";
    const supa = await createClient();
    const id = String(formData.get("id"));
    const name = String(formData.get("name"));
    const price_cents = Number(formData.get("price_cents") || 0);
    const visible = formData.get("visible") === "on";
    const in_house = formData.get("in_house") === "on";
    const affiliate_url = String(formData.get("affiliate_url") || "");
    await supa.from("products").update({ name, price_cents, visible, in_house, affiliate_url: affiliate_url || null }).eq("id", id);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Shop Admin</h1>
      <div className="space-y-3">
        {(products ?? []).map((p) => (
          <form key={p.id} action={updateProduct} className="border rounded p-3 grid md:grid-cols-2 gap-2">
            <input type="hidden" name="id" value={p.id} />
            <div>
              <label className="block text-xs mb-1">Name</label>
              <input name="name" defaultValue={p.name} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Price (cents)</label>
              <input name="price_cents" type="number" defaultValue={p.price_cents ?? 0} className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs mb-1">Affiliate URL</label>
              <input name="affiliate_url" defaultValue={p.affiliate_url ?? ""} className="border rounded px-2 py-1 w-full" />
            </div>
            <div className="flex items-center gap-4 mt-5">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="visible" defaultChecked={!!p.visible} /> visible
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="in_house" defaultChecked={!!p.in_house} /> in-house
              </label>
            </div>
            <div className="col-span-full"><button type="submit" className="underline">Save</button></div>
          </form>
        ))}
        {(!products || products.length === 0) && <div>No products yet.</div>}
      </div>
    </div>
  );
}


