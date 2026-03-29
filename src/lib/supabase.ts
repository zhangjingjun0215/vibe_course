import "server-only";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY_KEYS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function readEnvironmentValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

export function getSupabaseConfigStatus() {
  const supabaseUrl = readEnvironmentValue(SUPABASE_URL_KEYS);
  const supabaseKey = readEnvironmentValue(SUPABASE_KEY_KEYS);
  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseKey) {
    missing.push(
      "SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function getSupabaseServerClient() {
  const supabaseUrl = readEnvironmentValue(SUPABASE_URL_KEYS);
  const supabaseKey = readEnvironmentValue(SUPABASE_KEY_KEYS);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
