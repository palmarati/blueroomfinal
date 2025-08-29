import { NextResponse } from "next/server";
import { makeSquareClient } from "@/lib/square-client";

export const runtime = "nodejs";

function getSquareEnv() {
  const env = process.env.SQUARE_ENV === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
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

export async function GET() {
  try {
    const env = getSquareEnv();
    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_APPLICATION_ID) {
      return NextResponse.json({ error: "Square env vars missing" }, { status: 500 });
    }
    const client = makeSquareClient(env, process.env.SQUARE_ACCESS_TOKEN!);
    const { result } = await client.locationsApi.listLocations();
    const loc = result.locations?.find((l) => l.status === "ACTIVE" && (l.capabilities ?? []).includes("CREDIT_CARD_PROCESSING"));
    if (!loc) return NextResponse.json({ error: "No active location with card processing" }, { status: 500 });
    return NextResponse.json({ applicationId: process.env.SQUARE_APPLICATION_ID, locationId: loc.id, env });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

 