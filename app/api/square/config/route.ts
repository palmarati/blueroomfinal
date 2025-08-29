import { NextResponse } from "next/server";
import { Client, Environment } from "square";

export const runtime = "nodejs";

function getSquareEnv() {
  const env = process.env.SQUARE_ENV?.toLowerCase() === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
}

function getSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set");
  }
  const env = getSquareEnv();
  const environment = env === "production" ? Environment.Production : Environment.Sandbox;
  return new Client({ accessToken, environment });
}

async function chooseActiveCardLocation(client: Client) {
  const { result } = await client.locationsApi.listLocations();
  const locations = result.locations ?? [];
  const activeWithCard = locations.find((loc) => {
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
    const client = getSquareClient();
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

 