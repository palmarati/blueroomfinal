import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const form = await request.formData();
  const productId = String(form.get("product_id"));
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("cart_session")?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set("cart_session", sessionId, { path: "/", httpOnly: false, sameSite: "lax" });
  }

  const supabase = await createClient();
  // ensure cart exists
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  let cartId = cart?.id;
  if (!cartId) {
    const { data: created, error } = await supabase
      .from("carts")
      .insert({ session_id: sessionId })
      .select("id")
      .single();
    if (error) {
      return NextResponse.redirect(new URL("/shop?error=cart", request.url));
    }
    cartId = created.id;
  }

  // fetch product price snapshot
  const { data: prod } = await supabase
    .from("products")
    .select("price_cents")
    .eq("id", productId)
    .maybeSingle();

  if (!prod) {
    return NextResponse.redirect(new URL("/shop?error=product", request.url));
  }

  // upsert line
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id,quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("cart_items")
      .insert({ cart_id: cartId, product_id: productId, quantity: 1, price_cents_snapshot: prod.price_cents });
  }

  return NextResponse.redirect(new URL("/shop", request.url));
}


