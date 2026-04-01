import { NextResponse } from "next/server";

import {
  MAX_MESSAGES_IN_ADMIN,
  toAdminMessage,
  type MessageRow,
} from "@/lib/board";
import {
  createAdminSetupErrorResponse,
  createForbiddenResponse,
  createSupabaseSetupErrorResponse,
  getAdminConfigStatus,
  getViewer,
} from "@/lib/server-auth";
import {
  getSupabaseAdminClient,
  getSupabaseConfigStatus,
} from "@/lib/supabase";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  if (!getSupabaseConfigStatus().ready) {
    return createSupabaseSetupErrorResponse();
  }

  if (!getAdminConfigStatus().ready) {
    return createAdminSetupErrorResponse();
  }

  const viewer = await getViewer();

  if (!viewer.isAdmin) {
    return createForbiddenResponse("Only the admin account can open the moderation dashboard.");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, created_at, updated_at, author_key")
      .order("created_at", { ascending: false })
      .limit(MAX_MESSAGES_IN_ADMIN);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load messages for moderation.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as MessageRow[];
    const uniqueSourceBuckets = new Set(
      rows
        .map((message) => message.author_key)
        .filter((sourceBucket): sourceBucket is string => Boolean(sourceBucket))
    );

    return NextResponse.json({
      data: rows.map((message) => toAdminMessage(message)),
      stats: {
        totalMessages: rows.length,
        totalSourceBuckets: uniqueSourceBuckets.size,
      },
      viewer,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load the admin dashboard data.",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
