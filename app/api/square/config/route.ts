import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getSquareEnv() {
  const env = process.env.SQUARE_ENV?.toLowerCase() === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
}

async function loadSquare() {
  // Dynamic import to avoid ESM/CJS interop issues in Next route handlers
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

export async function GET() {
  try {
    const applicationId = process.env.SQUARE_APPLICATION_ID;
    if (!applicationId) {
      return NextResponse.json({ error: "Missing SQUARE_APPLICATION_ID" }, { status: 500 });
    }
    const client = await getSquareClient();
    const locationId = await chooseActiveCardLocation(client);
    if (!locationId) {
      return NextResponse.json({ error: "No ACTIVE Square location with CREDIT_CARD_PROCESSING found" }, { status: 500 });
    }
    const env = getSquareEnv();
    return NextResponse.json({ applicationId, locationId, env });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

 