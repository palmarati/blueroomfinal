import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSquarePayment, getOrCreateSquareCustomer } from "@/lib/square";

type PayBody = {
	amountCents: number;
	sourceId?: string;
	useSaved?: boolean;
	for: "order" | "appointment";
	orderId?: string;
	appointmentId?: string;
	manualCapture?: boolean;
};

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as PayBody;
		if (!body?.amountCents || !body.for) return NextResponse.json({ error: "bad_request" }, { status: 400 });
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

		const payment = await createSquarePayment({
			amountCents: body.amountCents,
			sourceId: body.sourceId,
			customerId,
			cardId,
			autocomplete: body.manualCapture ? false : true,
			note: body.for === "order" ? `Order ${body.orderId ?? "N/A"}` : `Appointment ${body.appointmentId ?? "N/A"}`,
		});

		return NextResponse.json(payment);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "payment_error" }, { status: 500 });
	}
}


