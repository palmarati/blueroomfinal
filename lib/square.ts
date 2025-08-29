import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const SQUARE_ENV = (process.env.SQUARE_ENV || "production").toLowerCase();
const SQUARE_BASE_URL = SQUARE_ENV === "sandbox"
	? "https://connect.squareupsandbox.com"
	: "https://connect.squareup.com";

function getAccessToken(): string {
	const token = process.env.SQUARE_ACCESS_TOKEN;
	if (!token) {
		throw new Error("Missing SQUARE_ACCESS_TOKEN env var");
	}
	return token;
}

export async function fetchSquare<T>(path: string, init?: RequestInit): Promise<T> {
	const token = getAccessToken();
	const res = await fetch(`${SQUARE_BASE_URL}${path}`, {
		method: init?.method ?? "GET",
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json",
			"Accept": "application/json",
			...(init?.headers || {}),
		},
		body: init?.body,
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Square API ${path} failed: ${res.status} ${res.statusText} - ${body}`);
	}
	return res.json() as Promise<T>;
}

export type SquareLocation = {
	id: string;
	name?: string;
	currency?: string;
};

export async function getDefaultLocationId(): Promise<string> {
	const data = await fetchSquare<{ locations: SquareLocation[] }>("/v2/locations");
	const first = data.locations?.find((l) => true);
	if (!first?.id) throw new Error("No Square locations found for the account");
	return first.id;
}

export async function getSquareConfig(): Promise<{ applicationId: string; locationId: string }> {
	const applicationId = process.env.SQUARE_APPLICATION_ID;
	if (!applicationId) throw new Error("Missing SQUARE_APPLICATION_ID env var");
	const locationId = await getDefaultLocationId();
	return { applicationId, locationId };
}

export async function getOrCreateSquareCustomer(params: { email?: string | null; firstName?: string | null; lastName?: string | null; clientId?: string | null }): Promise<{ customerId: string }> {
	// If we later persist a customer id per client, we could look it up here via payment_methods.
	// For now, try search by email, else create.
	const email = params.email ?? undefined;
	if (email) {
		try {
			const search = await fetchSquare<{ customers?: Array<{ id: string }> }>("/v2/customers/search", {
				method: "POST",
				body: JSON.stringify({
					query: { filter: { email_address: { exact: email } } },
				}),
			});
			const found = search.customers?.[0]?.id;
			if (found) return { customerId: found };
		} catch (_) {
			// fall through to create
		}
	}
	const created = await fetchSquare<{ customer: { id: string } }>("/v2/customers", {
		method: "POST",
		body: JSON.stringify({
			email_address: email,
			given_name: params.firstName ?? undefined,
			family_name: params.lastName ?? undefined,
		}),
	});
	return { customerId: created.customer.id };
}

export async function createSquareCard(params: { customerId: string; sourceId: string; verificationToken?: string }): Promise<{ card: { id: string; last_4?: string; exp_month?: number; exp_year?: number; card_brand?: string } }> {
	const body = {
		idempotency_key: crypto.randomUUID(),
		card: {
			customer_id: params.customerId,
			source_id: params.sourceId,
			verification_token: params.verificationToken,
		},
	};
	return fetchSquare("/v2/cards", { method: "POST", body: JSON.stringify(body) });
}

export async function disableSquareCard(cardId: string): Promise<void> {
	await fetchSquare(`/v2/cards/${cardId}/disable`, { method: "POST" });
}

export async function createSquarePayment(params: { amountCents: number; sourceId?: string; customerId?: string; cardId?: string; note?: string; autocomplete?: boolean }): Promise<{ payment: { id: string; status: string } }> {
	const locationId = await getDefaultLocationId();
	const amountMoney = { amount: params.amountCents, currency: "USD" };
	const body: any = {
		idempotency_key: crypto.randomUUID(),
		amount_money: amountMoney,
		location_id: locationId,
		note: params.note,
		autocomplete: params.autocomplete !== false,
	};
	if (params.sourceId) body.source_id = params.sourceId;
	if (params.customerId) body.customer_id = params.customerId;
	if (params.cardId) body.card_id = params.cardId;
	return fetchSquare("/v2/payments", { method: "POST", body: JSON.stringify(body) });
}

export function mapSquareStatusToInternal(status: string): "authorized" | "captured" | "failed" {
	const s = (status || "").toUpperCase();
	if (s === "APPROVED" || s === "AUTHORIZED") return "authorized";
	if (s === "COMPLETED" || s === "CAPTURED") return "captured";
	return "failed";
}


