import { Client } from "square";

export type SqEnv = "production" | "sandbox";

export function makeSquareClient(env: SqEnv, accessToken: string) {
  if (!accessToken) throw new Error("Square access token missing");
  return new Client({
    accessToken,
    environment: env as any,
  });
}


