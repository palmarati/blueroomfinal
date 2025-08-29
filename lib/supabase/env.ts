// Centralized, safe access to Supabase environment variables with sensible fallbacks.

type NonEmptyString = string & { __brand: "NonEmptyString" };

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return undefined;
}

export const SUPABASE_URL: NonEmptyString | undefined =
  (readEnv("NEXT_PUBLIC_SUPABASE_URL") as NonEmptyString | undefined) ??
  // Back-compat: some setups may use SUPABASE_URL without NEXT_PUBLIC_
  (readEnv("SUPABASE_URL") as NonEmptyString | undefined);

export const SUPABASE_ANON_KEY: NonEmptyString | undefined =
  // Current preferred name in this repo
  (readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY") as
    | NonEmptyString
    | undefined) ??
  // Common name from Supabase quickstarts and our README
  (readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") as NonEmptyString | undefined) ??
  // Occasionally used alternative
  (readEnv("NEXT_PUBLIC_SUPABASE_KEY") as NonEmptyString | undefined);

export const SUPABASE_SERVICE_ROLE_KEY: NonEmptyString | undefined =
  (readEnv("SUPABASE_SERVICE_ROLE_KEY") as NonEmptyString | undefined);

export const hasSupabasePublicEnv: boolean =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);


