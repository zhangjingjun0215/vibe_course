export const MAX_MESSAGE_LENGTH = 280;
export const MAX_MESSAGES_ON_HOME = 50;
export const MAX_MESSAGES_IN_ADMIN = 200;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_POSTS_PER_HOUR = 8;
export const MAX_SEARCH_LENGTH = 80;
export const MIN_SECONDS_BETWEEN_POSTS = 20;

export type ViewerRole = "admin" | "guest";

export type Viewer = {
  isAdmin: boolean;
  role: ViewerRole;
};

export type PixelAvatar = {
  backgroundColor: string;
  dataUri: string;
  foregroundColor: string;
};

export type MessageRow = {
  author_key: string | null;
  content: string;
  created_at: string | null;
  id: number;
  nickname: string | null;
  updated_at: string | null;
};

export type PublicMessage = {
  avatar: PixelAvatar;
  canDelete: boolean;
  content: string;
  createdAt: string;
  id: number;
  isEdited: boolean;
  nickname: string;
  updatedAt: string;
};

export type AdminMessage = {
  avatar: PixelAvatar;
  content: string;
  createdAt: string;
  id: number;
  isEdited: boolean;
  nickname: string;
  sourceBucket: string;
  updatedAt: string;
};

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondary;
  } else if (huePrime >= 1 && huePrime < 2) {
    red = secondary;
    green = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    green = chroma;
    blue = secondary;
  } else if (huePrime >= 3 && huePrime < 4) {
    green = secondary;
    blue = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const adjustment = normalizedLightness - chroma / 2;
  const toHex = (channel: number) =>
    Math.round((channel + adjustment) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function escapeSvgAttribute(value: string) {
  return value.replaceAll('"', "&quot;");
}

function buildAvatarCells(seed: string) {
  const cells: string[] = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const hash = hashString(`${seed}:${row}:${column}`);
      const active = (hash % 7) >= 2;

      if (!active) {
        continue;
      }

      const mirroredColumn = 7 - column;
      cells.push(`<rect x="${column}" y="${row}" width="1" height="1" />`);

      if (mirroredColumn !== column) {
        cells.push(
          `<rect x="${mirroredColumn}" y="${row}" width="1" height="1" />`
        );
      }
    }
  }

  if (cells.length > 0) {
    return cells.join("");
  }

  return [
    '<rect x="2" y="2" width="1" height="1" />',
    '<rect x="5" y="2" width="1" height="1" />',
    '<rect x="3" y="4" width="2" height="1" />',
    '<rect x="2" y="5" width="1" height="1" />',
    '<rect x="5" y="5" width="1" height="1" />',
  ].join("");
}

export function buildSourceBucket(authorKey: string | null) {
  return authorKey ? authorKey.slice(0, 12) : "legacy";
}

export function createPixelAvatar(seed: string | null): PixelAvatar {
  const canonicalSeed = seed?.trim() || "legacy";
  const toneHash = hashString(`${canonicalSeed}:tone`);
  const hue = toneHash % 360;
  const backgroundColor = hslToHex(hue, 52, 88);
  const foregroundColor = hslToHex((hue + 28) % 360, 46, 28);
  const cells = buildAvatarCells(canonicalSeed);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges" role="img" aria-hidden="true">
      <rect width="8" height="8" rx="1.4" fill="${escapeSvgAttribute(backgroundColor)}" />
      <g fill="${escapeSvgAttribute(foregroundColor)}">${cells}</g>
    </svg>
  `.trim();

  return {
    backgroundColor,
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    foregroundColor,
  };
}

export function normalizeMessageContent(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeNickname(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function normalizeSearchQuery(value: string) {
  return value.trim().slice(0, MAX_SEARCH_LENGTH);
}

export function parseMessageId(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function matchesAdminSearch(message: AdminMessage, query: string) {
  const normalizedQuery = normalizeSearchQuery(query).toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return `${message.nickname} ${message.content} ${message.sourceBucket}`
    .toLowerCase()
    .includes(normalizedQuery);
}

export function toPublicMessage(row: MessageRow, viewer: Viewer): PublicMessage {
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  const nickname = normalizeNickname(row.nickname) || "Guest";

  return {
    avatar: createPixelAvatar(row.author_key),
    canDelete: viewer.isAdmin,
    content: row.content,
    createdAt,
    id: row.id,
    isEdited: updatedAt !== createdAt,
    nickname,
    updatedAt,
  };
}

export function toAdminMessage(row: MessageRow): AdminMessage {
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const updatedAt = row.updated_at ?? createdAt;
  const nickname = normalizeNickname(row.nickname) || "Guest";

  return {
    avatar: createPixelAvatar(row.author_key),
    content: row.content,
    createdAt,
    id: row.id,
    isEdited: updatedAt !== createdAt,
    nickname,
    sourceBucket: buildSourceBucket(row.author_key),
    updatedAt,
  };
}
