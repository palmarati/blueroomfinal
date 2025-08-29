import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getSquareEnv() {
  const env = process.env.SQUARE_ENV?.toLowerCase() === "production" ? "production" : "sandbox";
  return env as "sandbox" | "production";
}

function getScriptUrl(env: "sandbox" | "production") {
  return env === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

async function loadSquare() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("square");
  const ns = mod?.default ?? mod;
  return { Client: ns.Client, Environment: ns.Environment };
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

export async function GET() {
  try {
    const env = getSquareEnv();
    const applicationIdPresent = Boolean(process.env.SQUARE_APPLICATION_ID);
    const scriptUrl = getScriptUrl(env);
    const client = await getSquareClient();
    const { result } = await client.locationsApi.listLocations();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locationIdFound = Boolean((result.locations ?? []).find((loc: any) => (loc.status === "ACTIVE") && (loc.capabilities ?? []).includes("CREDIT_CARD_PROCESSING")));
    return NextResponse.json({ ok: true, env, applicationIdPresent, locationIdFound, scriptUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


