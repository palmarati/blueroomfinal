import { NextResponse } from "next/server";
import { Client, Environment } from "square";

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

function getSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set");
  }
  const env = getSquareEnv();
  const environment = env === "production" ? Environment.Production : Environment.Sandbox;
  return new Client({ accessToken, environment });
}

export async function GET() {
  try {
    const env = getSquareEnv();
    const applicationIdPresent = Boolean(process.env.SQUARE_APPLICATION_ID);
    const scriptUrl = getScriptUrl(env);
    const client = getSquareClient();
    const { result } = await client.locationsApi.listLocations();
    const locationIdFound = Boolean(
      (result.locations ?? []).find((loc) => (loc.status === "ACTIVE") && (loc.capabilities ?? []).includes("CREDIT_CARD_PROCESSING"))
    );
    return NextResponse.json({ ok: true, env, applicationIdPresent, locationIdFound, scriptUrl });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Unknown" }, { status: 500 });
  }
}


