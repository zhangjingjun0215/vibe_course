import "server-only";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY_KEYS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const SUPABASE_ADMIN_KEY_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
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

function getSupabaseUrl() {
  return readEnvironmentValue(SUPABASE_URL_KEYS);
}

function getSupabasePublishableKey() {
  return readEnvironmentValue(SUPABASE_KEY_KEYS);
}

function getSupabaseAdminKey() {
  return readEnvironmentValue(SUPABASE_ADMIN_KEY_KEYS);
}

export function getSupabaseConfigStatus() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();
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
    missing,
    ready: missing.length === 0,
  };
}

export function getSupabaseAdminConfigStatus() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseAdminKey()) {
    missing.push(
      "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_KEY"
    );
  }

  return {
    missing,
    ready: missing.length === 0,
  };
}

export function getSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

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

export function getSupabaseAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAdminKey = getSupabaseAdminKey();

  if (!supabaseUrl || !supabaseAdminKey) {
    throw new Error("Supabase admin environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
