import * as Square from "square";

export type SqEnv = "production" | "sandbox";

export function makeSquareClient(env: SqEnv, accessToken: string) {
  if (!accessToken) throw new Error("Square access token missing");
  const ClientCtor: any = (Square as any).Client;
  if (typeof ClientCtor !== "function") {
    throw new Error("Square SDK Client constructor not found");
  }
  return new ClientCtor({
    accessToken,
    environment: env as any,
  });
}


