import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";

export default async function CartPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session")?.value;
  const supabase = await createClient();
  let items: { id: string; quantity: number; price_cents_snapshot: number; product: { name: string } | null }[] = [];
  if (sessionId) {
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (cart?.id) {
      const { data } = await supabase
        .from("cart_items")
        .select("id,quantity,price_cents_snapshot,products(name)")
        .eq("cart_id", cart.id);
      type Row = { id: string; quantity: number; price_cents_snapshot: number; products: { name: string } | { name: string }[] | null };
      items = ((data ?? []) as Row[]).map((row) => {
        const prod = Array.isArray(row.products) ? row.products[0] ?? null : row.products ?? null;
        return {
          id: row.id,
          quantity: row.quantity,
          price_cents_snapshot: row.price_cents_snapshot,
          product: prod,
        };
      });
    }
  }

  const subtotal = items.reduce((acc, it) => acc + it.quantity * (it.price_cents_snapshot ?? 0), 0);

  async function checkout(formData: FormData) {
    "use server";
    const supabase = await createClient();
    // compute subtotal again server-side
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session")?.value;
    if (!sessionId) return;
    const { data: cart } = await supabase.from("carts").select("id, client_id").eq("session_id", sessionId).maybeSingle();
    if (!cart?.id) return;
    const { data: items } = await supabase
      .from("cart_items")
      .select("quantity,price_cents_snapshot")
      .eq("cart_id", cart.id);
    const subtotal = (items ?? []).reduce((acc, it) => acc + (it.quantity ?? 0) * (it.price_cents_snapshot ?? 0), 0);
    // Send client-side payment; here we only return amount
    return subtotal;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Cart</h1>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div>Your cart is empty.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-2">
              <div>{it.product?.name ?? "Product"}</div>
              <div className="text-sm">qty {it.quantity}</div>
              <div>${((it.price_cents_snapshot * it.quantity) / 100).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 font-semibold">Subtotal: ${(subtotal / 100).toFixed(2)}</div>
      {items.length > 0 && (
        <div className="mt-4">
          <DynamicCheckout amountCents={subtotal} />
        </div>
      )}
    </div>
  );
}

const DynamicCheckout = dynamic(() => import("./checkout-client"), { ssr: false });


