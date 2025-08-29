import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disableSquareCard } from "@/lib/square";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		const { cardId } = await request.json();
		if (!cardId) return NextResponse.json({ error: "missing_card" }, { status: 400 });
		const { data: client } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
		if (!client?.id) return NextResponse.json({ error: "no_client" }, { status: 400 });
		// Verify ownership
		const { data: pm } = await supabase
			.from("payment_methods")
			.select("id")
			.eq("client_id", client.id)
			.eq("square_card_id", cardId)
			.maybeSingle();
		if (!pm?.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
		await disableSquareCard(cardId);
		await supabase.from("payment_methods").delete().eq("id", pm.id);
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "delete_card_error" }, { status: 500 });
	}
}


