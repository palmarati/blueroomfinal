import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hasSupabasePublicEnv } from "./supabase/env";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Backwards-compatible export used by starter components
export const hasEnvVars = hasSupabasePublicEnv;
