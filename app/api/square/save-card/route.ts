import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSquareCard, getOrCreateSquareCustomer } from "@/lib/square";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const { sourceId, verificationToken } = await request.json();
		if (!sourceId) return NextResponse.json({ error: "missing_source" }, { status: 400 });
		const { data: client } = await supabase
			.from("clients")
			.select("id, first_name, last_name, email")
			.eq("user_id", user.id)
			.maybeSingle();
		if (!client?.id) return NextResponse.json({ error: "no_client" }, { status: 400 });

		const { customerId } = await getOrCreateSquareCustomer({
			email: client.email,
			firstName: client.first_name,
			lastName: client.last_name,
			clientId: client.id,
		});
		const { card } = await createSquareCard({ customerId, sourceId, verificationToken });
		await supabase.from("payment_methods").insert({
			client_id: client.id,
			square_customer_id: customerId,
			square_card_id: card.id,
			brand: card.card_brand ?? null,
			last4: card.last_4 ?? null,
			exp_month: card.exp_month ?? null,
			exp_year: card.exp_year ?? null,
			is_default: true,
		});
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "save_card_error" }, { status: 500 });
	}
}


