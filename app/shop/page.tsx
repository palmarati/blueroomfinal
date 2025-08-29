import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ShopPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,slug,price_cents,affiliate_url,in_house,visible")
    .eq("visible", true)
    .order("name");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Shop</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {(products ?? []).map((p) => (
          <div key={p.id} className="border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{p.name}</h2>
              </div>
              <div>${((p.price_cents ?? 0) / 100).toFixed(2)}</div>
            </div>
            <div className="mt-3 flex gap-3">
              {p.affiliate_url ? (
                <a href={p.affiliate_url} target="_blank" className="underline" rel="noreferrer">
                  Buy from partner
                </a>
              ) : (
                <form action={`/shop/add-to-cart`} method="post">
                  <input type="hidden" name="product_id" value={p.id} />
                  <button type="submit" className="underline">Add to cart</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/shop/cart" className="underline">View cart</Link>
      </div>
    </div>
  );
}


