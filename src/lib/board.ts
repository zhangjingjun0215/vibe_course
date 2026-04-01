export const MAX_MESSAGE_LENGTH = 280;
export const MAX_MESSAGES_ON_HOME = 50;
export const MAX_MESSAGES_IN_ADMIN = 200;
export const MIN_SECONDS_BETWEEN_POSTS = 20;
export const MAX_POSTS_PER_HOUR = 8;

export type ViewerRole = "admin" | "guest";

export type Viewer = {
  isAdmin: boolean;
  role: ViewerRole;
};

export type MessageRow = {
  author_key: string | null;
  content: string;
  created_at: string | null;
  id: number;
  updated_at: string | null;
};

export type PublicMessage = {
  canDelete: boolean;
  content: string;
  createdAt: string;
  id: number;
  isEdited: boolean;
  updatedAt: string;
};

export type AdminMessage = {
  content: string;
  createdAt: string;
  id: number;
  sourceBucket: string;
  updatedAt: string;
};

export function normalizeMessageContent(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseMessageId(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function toPublicMessage(row: MessageRow, viewer: Viewer): PublicMessage {
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const updatedAt = row.updated_at ?? createdAt;

  return {
    canDelete: viewer.isAdmin,
    content: row.content,
    createdAt,
    id: row.id,
    isEdited: updatedAt !== createdAt,
    updatedAt,
  };
}

export function toAdminMessage(row: MessageRow): AdminMessage {
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const updatedAt = row.updated_at ?? createdAt;

  return {
    content: row.content,
    createdAt,
    id: row.id,
    sourceBucket: row.author_key ? row.author_key.slice(0, 12) : "legacy",
    updatedAt,
  };
}
