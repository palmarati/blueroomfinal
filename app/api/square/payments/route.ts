import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createSquarePayment, getOrCreateSquareCustomer, mapSquareStatusToInternal } from "@/lib/square";

type PayBody = {
	amountCents: number;
	sourceId?: string;
	useSaved?: boolean;
	for: "order" | "appointment";
	orderId?: string;
	appointmentId?: string;
  // manualCapture is optional; if not provided, we'll read business_settings.payments_mode
	manualCapture?: boolean;
};

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as PayBody;
		if (!body?.for) return NextResponse.json({ error: "bad_request" }, { status: 400 });
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		const { data: client } = await supabase
			.from("clients")
			.select("id, email, first_name, last_name")
			.eq("user_id", user?.id ?? null)
			.maybeSingle();

		let customerId: string | undefined;
		let cardId: string | undefined;
		if (client?.id) {
			const { data: pm } = await supabase
				.from("payment_methods")
				.select("square_customer_id,square_card_id")
				.eq("client_id", client.id)
				.eq("is_default", true)
				.maybeSingle();
			if (pm?.square_customer_id && pm?.square_card_id && (body.useSaved || !body.sourceId)) {
				customerId = pm.square_customer_id;
				cardId = pm.square_card_id;
			}
		}

		if (!cardId && !body.sourceId) {
			// No saved card; require sourceId
			return NextResponse.json({ error: "missing_source" }, { status: 400 });
		}

		if (!customerId && (body.sourceId || body.useSaved)) {
			const { customerId: cid } = await getOrCreateSquareCustomer({
				email: client?.email ?? null,
				firstName: client?.first_name ?? null,
				lastName: client?.last_name ?? null,
				clientId: client?.id ?? null,
			});
			customerId = cid;
		}

		// Determine payments mode (authorize vs capture)
		let autocomplete = true;
		if (typeof body.manualCapture === "boolean") {
			autocomplete = body.manualCapture ? false : true;
		} else {
			const { data: bs } = await supabase.from("business_settings").select("payments_mode").limit(1).maybeSingle();
			autocomplete = bs?.payments_mode === "authorize" ? false : true;
		}

		// If order context and no orderId, assemble order from cart
		let orderId = body.orderId;
		let amountCents = body.amountCents ?? 0;
		if (body.for === "order" && !orderId) {
			const cookieStore = await cookies();
			const sessionId = cookieStore.get("cart_session")?.value;
			if (!sessionId) return NextResponse.json({ error: "no_cart" }, { status: 400 });
			const { data: cart } = await supabase.from("carts").select("id,client_id").eq("session_id", sessionId).maybeSingle();
			if (!cart?.id) return NextResponse.json({ error: "no_cart" }, { status: 400 });
			const { data: items } = await supabase
				.from("cart_items")
				.select("product_id,quantity,price_cents_snapshot,products(name,in_house)")
				.eq("cart_id", cart.id);
			const subtotal = (items ?? []).reduce((acc, it: any) => acc + (it.quantity ?? 0) * (it.price_cents_snapshot ?? 0), 0);
			amountCents = subtotal;
			// Create order
			const { data: createdOrder, error: orderErr } = await supabase
				.from("orders")
				.insert({ client_id: cart.client_id ?? client?.id ?? null, subtotal_cents: subtotal, total_cents: subtotal, status: "pending" })
				.select("id")
				.single();
			if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
			orderId = createdOrder.id;
			// Order items
			const itemsPayload = (items ?? []).map((it: any) => ({
				order_id: orderId,
				product_id: it.product_id,
				name_snapshot: Array.isArray(it.products) ? it.products[0]?.name ?? "Product" : it.products?.name ?? "Product",
				unit_price_cents: it.price_cents_snapshot,
				quantity: it.quantity,
				total_cents: (it.quantity ?? 0) * (it.price_cents_snapshot ?? 0),
			}));
			if (itemsPayload.length > 0) await supabase.from("order_items").insert(itemsPayload);
		}

		// If appointment context and no amount, compute from DB
		let appointmentId = body.appointmentId;
		if (body.for === "appointment" && appointmentId && (!body.amountCents || body.amountCents <= 0)) {
			const { data: appt } = await supabase
				.from("appointments")
				.select("id, service_id, service_option_id")
				.eq("id", appointmentId)
				.maybeSingle();
			if (!appt?.id) return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
			const { data: svc } = await supabase
				.from("services")
				.select("base_price_cents")
				.eq("id", appt.service_id)
				.maybeSingle();
			const { data: opt } = await supabase
				.from("service_options")
				.select("price_delta_cents")
				.eq("id", appt.service_option_id)
				.maybeSingle();
			const { data: addonRows } = await supabase
				.from("appointment_addons")
				.select("addons(price_delta_cents)")
				.eq("appointment_id", appt.id);
			const addonsDelta = (addonRows ?? []).reduce((acc, row: any) => acc + (Array.isArray(row.addons) ? (row.addons[0]?.price_delta_cents ?? 0) : (row.addons?.price_delta_cents ?? 0)), 0);
			amountCents = (svc?.base_price_cents ?? 0) + (opt?.price_delta_cents ?? 0) + addonsDelta;
		}

		// Create payment row (created)
		const { data: paymentRow } = await supabase
			.from("payments")
			.insert({
				client_id: client?.id ?? null,
				amount_cents: amountCents,
				status: "created",
				source: body.for,
				source_id: body.for === "order" ? (orderId as any) : (appointmentId as any),
			})
			.select("id")
			.single();

		const payment = await createSquarePayment({
			amountCents,
			sourceId: body.sourceId,
			customerId,
			cardId,
			autocomplete,
			note: body.for === "order" ? `Order ${orderId ?? "N/A"}` : `Appointment ${appointmentId ?? "N/A"}`,
		});

		const mapped = mapSquareStatusToInternal(payment?.payment?.status ?? "");
		await supabase.from("payments").update({ status: mapped, square_payment_id: payment?.payment?.id ?? null }).eq("id", paymentRow?.id);
		if (body.for === "order" && orderId) {
			// Update order with payment
			await supabase.from("orders").update({ payment_id: paymentRow?.id, status: mapped === "captured" ? "paid" : "pending" }).eq("id", orderId);
			// Clear cart if exists
			const cookieStore = await cookies();
			const sessionId = cookieStore.get("cart_session")?.value;
			if (sessionId) {
				const { data: cart } = await supabase.from("carts").select("id").eq("session_id", sessionId).maybeSingle();
				if (cart?.id) {
					await supabase.from("cart_items").delete().eq("cart_id", cart.id);
				}
			}
		}
		if (body.for === "appointment" && appointmentId) {
			await supabase
				.from("appointments")
				.update({ payment_status: mapped, square_payment_id: payment?.payment?.id ?? null })
				.eq("id", appointmentId);
		}

		return NextResponse.json({ ok: true, payment, orderId: orderId ?? null, appointmentId: appointmentId ?? null });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "payment_error" }, { status: 500 });
	}
}


