function resolveSquareBaseUrl(): string {
	const env = (process.env.SQUARE_ENV || "").toLowerCase();
	if (env === "sandbox") return "https://connect.squareupsandbox.com";
	if (env === "production" || env === "prod") return "https://connect.squareup.com";
	const appId = process.env.SQUARE_APPLICATION_ID || "";
	if (appId.startsWith("sandbox-")) return "https://connect.squareupsandbox.com";
	return "https://connect.squareup.com";
}

const SQUARE_BASE_URL = resolveSquareBaseUrl();

function getAccessToken(): string {
	const token = process.env.SQUARE_ACCESS_TOKEN;
	if (!token) throw new Error("Missing SQUARE_ACCESS_TOKEN env var");
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

export type SquareLocation = { id: string; name?: string };

export async function getDefaultLocationId(): Promise<string> {
	const data = await fetchSquare<{ locations: SquareLocation[] }>("/v2/locations");
	const first = data.locations?.[0];
	if (!first?.id) throw new Error("No Square locations found");
	return first.id;
}

export async function getSquareConfig(): Promise<{ applicationId: string; locationId: string }> {
	const applicationId = process.env.SQUARE_APPLICATION_ID;
	if (!applicationId) throw new Error("Missing SQUARE_APPLICATION_ID env var");
	const locationId = await getDefaultLocationId();
	return { applicationId, locationId };
}

export async function getOrCreateSquareCustomer(params: { email?: string | null; firstName?: string | null; lastName?: string | null }): Promise<{ customerId: string }> {
	const email = params.email ?? undefined;
	if (email) {
		try {
			const search = await fetchSquare<{ customers?: Array<{ id: string }> }>("/v2/customers/search", {
				method: "POST",
				body: JSON.stringify({ query: { filter: { email_address: { exact: email } } } }),
			});
			const found = search.customers?.[0]?.id;
			if (found) return { customerId: found };
		} catch {}
	}
	const created = await fetchSquare<{ customer: { id: string } }>("/v2/customers", {
		method: "POST",
		body: JSON.stringify({ email_address: email, given_name: params.firstName ?? undefined, family_name: params.lastName ?? undefined }),
	});
	return { customerId: created.customer.id };
}

export async function createSquarePayment(params: { amountCents: number; sourceId: string; customerId?: string; note?: string; autocomplete?: boolean }): Promise<{ payment: { id: string; status: string } }> {
	const locationId = await getDefaultLocationId();
	const body: any = {
		idempotency_key: crypto.randomUUID(),
		amount_money: { amount: params.amountCents, currency: "USD" },
		location_id: locationId,
		source_id: params.sourceId,
		note: params.note,
		autocomplete: params.autocomplete !== false,
	};
	if (params.customerId) body.customer_id = params.customerId;
	return fetchSquare("/v2/payments", { method: "POST", body: JSON.stringify(body) });
}

export async function createSquareCard(params: { customerId: string; sourceId: string }): Promise<void> {
	await fetchSquare("/v2/cards", {
		method: "POST",
		body: JSON.stringify({ idempotency_key: crypto.randomUUID(), card: { customer_id: params.customerId, source_id: params.sourceId } }),
	});
}

export function mapSquareStatusToInternal(status: string): "authorized" | "captured" | "failed" {
	const s = (status || "").toUpperCase();
	if (s === "APPROVED" || s === "AUTHORIZED") return "authorized";
	if (s === "COMPLETED" || s === "CAPTURED") return "captured";
	return "failed";
}

 