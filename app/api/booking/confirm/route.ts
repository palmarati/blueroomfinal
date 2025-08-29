import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSquarePayment, getOrCreateSquareCustomer, mapSquareStatusToInternal, createSquareCard } from "@/lib/square";

type Body = {
	service_id: string;
	service_option_id?: string | null;
	addon_ids?: string[];
	start_at: string;
	notes?: string;
	guest?: boolean;
	guest_email?: string;
	guest_first?: string;
	guest_last?: string;
	guest_phone?: string;
	sourceId: string;
};

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as Body;
		if (!body?.service_id || !body?.start_at || !body?.sourceId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		// get or create client id
		let clientId: string | null = null;
		if (!body.guest && user?.id) {
			const { data: c } = await supabase.from("clients").select("id,email,first_name,last_name").eq("user_id", user.id).maybeSingle();
			if (!c?.id) return NextResponse.json({ error: "client_not_found" }, { status: 400 });
			clientId = c.id;
		} else {
			const { data, error } = await supabase.rpc("get_or_create_client_by_email_guest", {
				p_email: body.guest_email,
				p_first_name: body.guest_first ?? null,
				p_last_name: body.guest_last ?? null,
				p_phone: body.guest_phone ?? null,
			});
			if (error) return NextResponse.json({ error: error.message }, { status: 400 });
			clientId = data as unknown as string;
		}

		// compute base price from service/option/addons
		const { data: svc } = await supabase.from("services").select("base_price_cents,base_duration_min,deposit_cents").eq("id", body.service_id).maybeSingle();
		if (!svc) return NextResponse.json({ error: "service_not_found" }, { status: 404 });
		let amountCents = svc.base_price_cents ?? 0;
		let durationMin = svc.base_duration_min ?? 0;
		if (body.service_option_id) {
			const { data: opt } = await supabase.from("service_options").select("price_delta_cents,duration_delta_min").eq("id", body.service_option_id).maybeSingle();
			amountCents += opt?.price_delta_cents ?? 0;
			durationMin += opt?.duration_delta_min ?? 0;
		}
		if (body.addon_ids?.length) {
			const { data: addonRows } = await supabase
				.from("addons")
				.select("id,price_delta_cents,duration_delta_min")
				.in("id", body.addon_ids);
			for (const a of addonRows ?? []) {
				amountCents += a.price_delta_cents ?? 0;
				durationMin += a.duration_delta_min ?? 0;
			}
		}
		const depositCents = Math.max(0, svc?.deposit_cents ?? 0);
		const toCharge = depositCents > 0 ? depositCents : amountCents;

		// payments mode
		const { data: bs } = await supabase.from("business_settings").select("payments_mode").limit(1).maybeSingle();
		const autocomplete = bs?.payments_mode === "authorize" ? false : true;

		let email = body.guest_email ?? undefined;
		if (!email && user?.email) email = user.email;
		const { customerId } = await getOrCreateSquareCustomer({ email, firstName: body.guest_first ?? undefined, lastName: body.guest_last ?? undefined });
		let mapped: "authorized" | "captured" | "failed" = "authorized";
		let squarePaymentId: string | null = null;
		if (toCharge > 0) {
			const payment = await createSquarePayment({ amountCents: toCharge, sourceId: body.sourceId, customerId, autocomplete, note: depositCents > 0 ? "Appointment deposit" : "Appointment payment" });
			mapped = mapSquareStatusToInternal(payment?.payment?.status ?? "");
			if (mapped === "failed") return NextResponse.json({ error: "payment_failed" }, { status: 402 });
			squarePaymentId = payment?.payment?.id ?? null;
		} else {
			// No charge required, but save card on file
			await createSquareCard({ customerId, sourceId: body.sourceId });
			mapped = "authorized";
		}

		const startAt = new Date(body.start_at);
		const endAt = new Date(startAt.getTime() + durationMin * 60000);
		const { data: appt, error: apptErr } = await supabase
			.from("appointments")
			.insert({
				client_id: clientId,
				service_id: body.service_id,
				service_option_id: body.service_option_id ?? null,
				start_at: startAt.toISOString(),
				end_at: endAt.toISOString(),
				notes: body.notes ?? null,
				payment_status: mapped,
				square_payment_id: squarePaymentId,
			})
			.select("id")
			.single();
		if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 500 });
		if (body.addon_ids?.length) {
			await supabase.from("appointment_addons").insert(body.addon_ids.map((id) => ({ appointment_id: appt.id, addon_id: id })));
		}
		await supabase.from("payments").insert({ client_id: clientId, amount_cents: toCharge, status: mapped, square_payment_id: squarePaymentId, source: "booking", source_id: appt.id });

		return NextResponse.json({ ok: true, appointmentId: appt.id });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "confirm_error" }, { status: 500 });
	}
}


