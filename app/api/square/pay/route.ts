import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type PayBody = {
  sourceId?: string;
  amountCents?: number;
};

function getSquareEnv() {
  const env = process.env.SQUARE_ENV?.toLowerCase() === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
}

async function loadSquare() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("square");
  return { Client: mod.Client, Environment: mod.Environment };
}

async function getSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set");
  }
  const env = getSquareEnv();
  const { Client, Environment } = await loadSquare();
  const environment = env === "production" ? Environment.Production : Environment.Sandbox;
  return new Client({ accessToken, environment });
}

async function chooseActiveCardLocation(client: any) {
  const { result } = await client.locationsApi.listLocations();
  const locations = result.locations ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeWithCard = locations.find((loc: any) => {
    const active = loc.status === "ACTIVE";
    const caps = loc.capabilities ?? [];
    return active && caps.includes("CREDIT_CARD_PROCESSING");
  });
  return activeWithCard?.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PayBody;
    const sourceId = body.sourceId;
    let amountCents = body.amountCents ?? 0;

    if (!sourceId) {
      return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });
    }

    // TODO: If booking flow has server-side amount computation, call it here.
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const client = await getSquareClient();
    const locationId = await chooseActiveCardLocation(client);
    if (!locationId) {
      return NextResponse.json({ error: "No ACTIVE Square location with CREDIT_CARD_PROCESSING found" }, { status: 500 });
    }

    const idempotencyKey = crypto.randomUUID();
    const { result } = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey,
      locationId,
      amountMoney: { amount: BigInt(amountCents), currency: "USD" },
    });
    return NextResponse.json(result.payment ?? result);
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    const errorBody = err?.result ?? { error: err?.message ?? "Unknown error" };
    return NextResponse.json(errorBody, { status });
  }
}


