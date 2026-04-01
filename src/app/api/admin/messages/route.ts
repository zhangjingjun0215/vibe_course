import { NextResponse } from "next/server";

import {
  MAX_MESSAGES_IN_ADMIN,
  parseMessageId,
  toAdminMessage,
  type MessageRow,
} from "@/lib/board";
import { deleteMessagesWithLogs } from "@/lib/moderation";
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

async function requireAdminViewer() {
  if (!getSupabaseConfigStatus().ready) {
    return createSupabaseSetupErrorResponse();
  }

  if (!getAdminConfigStatus().ready) {
    return createAdminSetupErrorResponse();
  }

  const viewer = await getViewer();

  if (!viewer.isAdmin) {
    return createForbiddenResponse(
      "Only the admin account can open the moderation dashboard."
    );
  }

  return viewer;
}

export async function GET() {
  const viewer = await requireAdminViewer();

  if (viewer instanceof NextResponse) {
    return viewer;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id, nickname, content, created_at, updated_at, author_key")
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

    return NextResponse.json({
      data: ((data ?? []) as MessageRow[]).map((message) => toAdminMessage(message)),
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

export async function DELETE(request: Request) {
  const viewer = await requireAdminViewer();

  if (viewer instanceof NextResponse) {
    return viewer;
  }

  let payload: { ids?: unknown };

  try {
    payload = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids
        .map((value) => parseMessageId(String(value)))
        .filter((value): value is number => value !== null)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one message to delete." },
      { status: 400 }
    );
  }

  try {
    const result = await deleteMessagesWithLogs(ids, "delete_bulk");

    if (result.deleted.length === 0) {
      return NextResponse.json(
        { error: "No matching messages were found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deletedIds: result.deleted.map((message) => message.id),
      message: `${result.deleted.length} message${result.deleted.length === 1 ? "" : "s"} deleted.`,
      viewer,
      warning: result.warning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete the selected messages.",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
