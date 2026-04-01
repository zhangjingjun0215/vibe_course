import "server-only";

import { buildSourceBucket, type MessageRow } from "@/lib/board";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type ModerationAction = "delete_bulk" | "delete_single";

type DeletedMessageSnapshot = Pick<MessageRow, "author_key" | "id" | "nickname">;

export type ModerationDeleteResult = {
  deleted: DeletedMessageSnapshot[];
  warning?: string;
};

function uniqueMessageIds(messageIds: number[]) {
  return [...new Set(messageIds.filter((messageId) => Number.isInteger(messageId) && messageId > 0))];
}

export async function deleteMessagesWithLogs(
  messageIds: number[],
  action: ModerationAction
): Promise<ModerationDeleteResult> {
  const uniqueIds = uniqueMessageIds(messageIds);

  if (uniqueIds.length === 0) {
    return {
      deleted: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: deletedRows, error: deleteError } = await supabase
    .from("messages")
    .delete()
    .in("id", uniqueIds)
    .select("id, nickname, author_key");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const deleted = (deletedRows ?? []) as DeletedMessageSnapshot[];

  if (deleted.length === 0) {
    return {
      deleted,
    };
  }

  const { error: logError } = await supabase.from("admin_logs").insert(
    deleted.map((message) => ({
      action,
      actor: "admin_session",
      message_id: message.id,
      nickname_snapshot: message.nickname ?? "Guest",
      source_bucket: buildSourceBucket(message.author_key),
    }))
  );

  if (logError) {
    return {
      deleted,
      warning:
        "Messages were deleted, but the moderation log could not be written.",
    };
  }

  return {
    deleted,
  };
}
