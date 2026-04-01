import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { Viewer } from "@/lib/board";
import {
  getSupabaseAdminConfigStatus,
  getSupabaseConfigStatus,
} from "@/lib/supabase";

const ADMIN_PASSWORD_KEYS = ["ADMIN_PASSWORD", "GUESTBOOK_ADMIN_PASSWORD"];
const ADMIN_SESSION_SECRET_KEYS = [
  "ADMIN_SESSION_SECRET",
  "GUESTBOOK_ADMIN_SESSION_SECRET",
];
const ADMIN_COOKIE_NAME = "field-notes-admin-session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function readEnvironmentValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

function getAdminPassword() {
  return readEnvironmentValue(ADMIN_PASSWORD_KEYS);
}

function getAdminSessionSecret() {
  return (
    readEnvironmentValue(ADMIN_SESSION_SECRET_KEYS) ??
    getAdminPassword()
  );
}

function digestValue(value: string) {
  return createHash("sha256").update(value).digest();
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createCookieValue(secret: string) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
      role: "admin",
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${signPayload(payload, secret)}`;
}

function parseViewerFromCookie(cookieValue: string | undefined | null): Viewer {
  const secret = getAdminSessionSecret();

  if (!cookieValue || !secret) {
    return {
      isAdmin: false,
      role: "guest",
    };
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature) {
    return {
      isAdmin: false,
      role: "guest",
    };
  }

  const expectedSignature = signPayload(payload, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return {
      isAdmin: false,
      role: "guest",
    };
  }

  try {
    const parsedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as {
      exp?: number;
      role?: string;
    };

    if (parsedPayload.role !== "admin") {
      return {
        isAdmin: false,
        role: "guest",
      };
    }

    if (typeof parsedPayload.exp !== "number" || parsedPayload.exp <= Date.now()) {
      return {
        isAdmin: false,
        role: "guest",
      };
    }

    return {
      isAdmin: true,
      role: "admin",
    };
  } catch {
    return {
      isAdmin: false,
      role: "guest",
    };
  }
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function getAdminConfigStatus() {
  const missing: string[] = [];

  if (!getAdminPassword()) {
    missing.push("ADMIN_PASSWORD or GUESTBOOK_ADMIN_PASSWORD");
  }

  const adminSupabaseStatus = getSupabaseAdminConfigStatus();
  missing.push(...adminSupabaseStatus.missing);

  return {
    missing,
    ready: missing.length === 0,
  };
}

export function createSupabaseSetupErrorResponse() {
  const { missing } = getSupabaseConfigStatus();

  return NextResponse.json(
    {
      error:
        "Supabase is not configured. Copy .env.example to .env.local and add your project values.",
      missing,
    },
    { status: 503 }
  );
}

export function createAdminSetupErrorResponse() {
  const { missing } = getAdminConfigStatus();

  return NextResponse.json(
    {
      error:
        "Admin mode is not configured. Add an admin password and a server-side Supabase key.",
      missing,
    },
    { status: 503 }
  );
}

export function createUnauthorizedResponse(message = "Admin sign-in required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function createForbiddenResponse(
  message = "This area is reserved for the admin account."
) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function verifyAdminPassword(candidate: string) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  const expected = digestValue(adminPassword);
  const provided = digestValue(candidate.trim());

  return timingSafeEqual(expected, provided);
}

export async function getViewer(): Promise<Viewer> {
  const cookieStore = await cookies();

  return parseViewerFromCookie(
    cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null
  );
}

export function applyAdminSession(response: NextResponse) {
  const secret = getAdminSessionSecret();

  if (!secret) {
    throw new Error("Admin session secret is not configured.");
  }

  response.cookies.set(
    ADMIN_COOKIE_NAME,
    createCookieValue(secret),
    buildCookieOptions()
  );

  return response;
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...buildCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
