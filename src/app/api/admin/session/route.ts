import { NextResponse } from "next/server";

import {
  applyAdminSession,
  clearAdminSession,
  createAdminSetupErrorResponse,
  createUnauthorizedResponse,
  getAdminConfigStatus,
  verifyAdminPassword,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  if (!getAdminConfigStatus().ready) {
    return createAdminSetupErrorResponse();
  }

  let payload: { password?: unknown };

  try {
    payload = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const password = typeof payload.password === "string" ? payload.password : "";

  if (!verifyAdminPassword(password)) {
    return createUnauthorizedResponse("The admin password is incorrect.");
  }

  return applyAdminSession(
    NextResponse.json({
      message: "Admin mode enabled.",
      viewer: {
        isAdmin: true,
        role: "admin",
      },
    })
  );
}

export async function DELETE() {
  return clearAdminSession(
    NextResponse.json({
      message: "Admin mode cleared.",
      viewer: {
        isAdmin: false,
        role: "guest",
      },
    })
  );
}
