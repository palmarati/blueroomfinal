export type SqEnv = "production" | "sandbox";

function baseUrl(env: SqEnv) {
  return env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  } as const;
}

export async function listLocationsREST(env: SqEnv, token: string) {
  const r = await fetch(`${baseUrl(env)}/v2/locations`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(`Square listLocations failed: ${r.status}`);
  return r.json() as Promise<{ locations?: Array<any> }>;
}

export async function createPaymentREST(
  env: SqEnv,
  token: string,
  body: { idempotencyKey: string; sourceId: string; locationId: string; amountCents: number }
) {
  const r = await fetch(`${baseUrl(env)}/v2/payments`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      idempotency_key: body.idempotencyKey,
      source_id: body.sourceId,
      location_id: body.locationId,
      amount_money: { amount: body.amountCents, currency: "USD" },
    }),
  });
  const json = await r.json();
  if (!r.ok) {
    const msg = json?.errors?.map((e: any) => e.detail || e.code).join("; ") || `HTTP ${r.status}`;
    throw new Error(`Square createPayment failed: ${msg}`);
  }
  return json;
}


