import { NextResponse } from "next/server";

import { getSupabaseConfigStatus, getSupabaseServerClient } from "@/lib/supabase";

const MAX_MESSAGE_LENGTH = 280;

function createSetupErrorResponse() {
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

export async function GET() {
  if (!getSupabaseConfigStatus().ready) {
    return createSetupErrorResponse();
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to load messages from Supabase.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  if (!getSupabaseConfigStatus().ready) {
    return createSetupErrorResponse();
  }

  let payload: { content?: unknown };

  try {
    payload = (await request.json()) as { content?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const content =
    typeof payload.content === "string" ? payload.content.trim() : "";

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

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .insert([{ content }])
    .select("id, content, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to save the message to Supabase.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
