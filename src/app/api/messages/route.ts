import { NextResponse } from "next/server";

import {
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES_ON_HOME,
  MAX_POSTS_PER_HOUR,
  MIN_SECONDS_BETWEEN_POSTS,
  normalizeMessageContent,
  toPublicMessage,
  type MessageRow,
} from "@/lib/board";
import { createSourceKey } from "@/lib/rate-limit";
import {
  createSupabaseSetupErrorResponse,
  getAdminConfigStatus,
  getViewer,
} from "@/lib/server-auth";
import {
  getSupabaseConfigStatus,
  getSupabaseServerClient,
} from "@/lib/supabase";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  if (!getSupabaseConfigStatus().ready) {
    return createSupabaseSetupErrorResponse();
  }

  const supabase = getSupabaseServerClient();

  try {
    const viewer = await getViewer();
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, created_at, updated_at, author_key")
      .order("created_at", { ascending: false })
      .limit(MAX_MESSAGES_ON_HOME);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load messages from Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      adminConfigured: getAdminConfigStatus().ready,
      data: ((data ?? []) as MessageRow[]).map((message) =>
        toPublicMessage(message, viewer)
      ),
      viewer,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load the guestbook.",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!getSupabaseConfigStatus().ready) {
    return createSupabaseSetupErrorResponse();
  }

  const supabase = getSupabaseServerClient();
  const viewer = await getViewer();

  let payload: { content?: unknown };

  try {
    payload = (await request.json()) as { content?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const content = normalizeMessageContent(payload.content);

  if (!content) {
    return NextResponse.json(
      { error: "Message content is required." },
      { status: 400 }
    );
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message content must be ${MAX_MESSAGE_LENGTH} characters or less.` },
      { status: 400 }
    );
  }

  const sourceKey = createSourceKey(request);

  try {
    const { data: latestMessage, error: latestMessageError } = await supabase
      .from("messages")
      .select("created_at")
      .eq("author_key", sourceKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string | null }>();

    if (latestMessageError) {
      return NextResponse.json(
        {
          error: "Failed to evaluate the posting cooldown.",
          details: latestMessageError.message,
        },
        { status: 500 }
      );
    }

    const lastCreatedAt = latestMessage?.created_at
      ? new Date(latestMessage.created_at).getTime()
      : null;
    const cooldownMs = MIN_SECONDS_BETWEEN_POSTS * 1000;

    if (lastCreatedAt && Date.now() - lastCreatedAt < cooldownMs) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((cooldownMs - (Date.now() - lastCreatedAt)) / 1000)
      );

      return NextResponse.json(
        {
          error: "You are posting too quickly. Please wait a moment.",
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const hourWindowStart = new Date(
      Date.now() - 60 * 60 * 1000
    ).toISOString();
    const { count, error: hourlyLimitError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("author_key", sourceKey)
      .gte("created_at", hourWindowStart);

    if (hourlyLimitError) {
      return NextResponse.json(
        {
          error: "Failed to evaluate the hourly limit.",
          details: hourlyLimitError.message,
        },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= MAX_POSTS_PER_HOUR) {
      return NextResponse.json(
        {
          error: "You have reached the hourly posting limit. Please try again later.",
          retryAfterSeconds: 3600,
        },
        { status: 429 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([{ author_key: sourceKey, content }])
      .select("id, content, created_at, updated_at, author_key")
      .single<MessageRow>();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to save the message to Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: toPublicMessage(data, viewer),
        viewer,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create the message.",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
