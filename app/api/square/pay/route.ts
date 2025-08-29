import { NextRequest, NextResponse } from "next/server";
import { makeSquareClient } from "@/lib/square-client";

export const runtime = "nodejs";

type PayBody = {
  sourceId?: string;
  amountCents?: number;
};

function getSquareEnv() {
  const env = process.env.SQUARE_ENV === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
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

    const client = makeSquareClient(env, process.env.SQUARE_ACCESS_TOKEN!);
    const { result } = await client.locationsApi.listLocations();
    const locationId = (result.locations ?? []).find((l) => l.status === "ACTIVE" && (l.capabilities ?? []).includes("CREDIT_CARD_PROCESSING"))?.id;
    if (!locationId) {
      return NextResponse.json({ error: "No ACTIVE Square location with CREDIT_CARD_PROCESSING found" }, { status: 500 });
    }

    const idempotencyKey = crypto.randomUUID();
    const { result: payResult } = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey,
      locationId,
      amountMoney: { amount: BigInt(amountCents), currency: "USD" },
    });
    return NextResponse.json(payResult.payment ?? payResult);
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    const errorBody = err?.result ?? { error: err?.message ?? "Unknown error" };
    return NextResponse.json(errorBody, { status });
  }
}


