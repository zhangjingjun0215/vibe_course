import { NextResponse } from "next/server";

import { parseMessageId } from "@/lib/board";
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
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .select("id")
      .maybeSingle<{ id: number }>();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to delete the message.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      viewer,
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
