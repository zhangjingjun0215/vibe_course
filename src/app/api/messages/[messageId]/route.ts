import { NextResponse } from "next/server";

import { parseMessageId } from "@/lib/board";
import { deleteMessagesWithLogs } from "@/lib/moderation";
import {
  createAdminSetupErrorResponse,
  createForbiddenResponse,
  createSupabaseSetupErrorResponse,
  getAdminConfigStatus,
  getViewer,
} from "@/lib/server-auth";
import { getSupabaseConfigStatus } from "@/lib/supabase";

type MessageRouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function DELETE(
  _request: Request,
  { params }: MessageRouteContext
) {
  if (!getSupabaseConfigStatus().ready) {
    return createSupabaseSetupErrorResponse();
  }

  if (!getAdminConfigStatus().ready) {
    return createAdminSetupErrorResponse();
  }

  const viewer = await getViewer();

  if (!viewer.isAdmin) {
    return createForbiddenResponse();
  }

  const { messageId: rawMessageId } = await params;
  const messageId = parseMessageId(rawMessageId);

  if (!messageId) {
    return NextResponse.json({ error: "Message id is invalid." }, { status: 400 });
  }

  try {
    const result = await deleteMessagesWithLogs([messageId], "delete_single");

    if (result.deleted.length === 0) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({
      deletedIds: result.deleted.map((message) => message.id),
      success: true,
      viewer,
      warning: result.warning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete the message.",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
