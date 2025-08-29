import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./env";

export function createAdminClient() {
  const url = SUPABASE_URL;
  const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin env vars missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}


