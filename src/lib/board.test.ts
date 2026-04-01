import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_NICKNAME_LENGTH,
  createPixelAvatar,
  normalizeNickname,
  toPublicMessage,
  type MessageRow,
  type Viewer,
} from "./board.ts";

const guestViewer: Viewer = {
  isAdmin: false,
  role: "guest",
};

test("normalizeNickname trims input and enforces the nickname limit", () => {
  assert.equal(normalizeNickname("   Ada Lovelace   "), "Ada Lovelace");
  assert.equal(normalizeNickname("x".repeat(MAX_NICKNAME_LENGTH + 12)).length, MAX_NICKNAME_LENGTH);
  assert.equal(normalizeNickname(42), "");
});

test("createPixelAvatar is deterministic for the same seed and changes across seeds", () => {
  const first = createPixelAvatar("seed-alpha");
  const second = createPixelAvatar("seed-alpha");
  const third = createPixelAvatar("seed-beta");

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, third);
});

test("toPublicMessage includes nickname, avatar, and edit metadata", () => {
  const row: MessageRow = {
    author_key: "author-bucket",
    content: "Field notes from the spring launch.",
    created_at: "2026-04-01T08:00:00.000Z",
    id: 9,
    nickname: "Mina",
    updated_at: "2026-04-01T09:15:00.000Z",
  };

  const message = toPublicMessage(row, guestViewer);

  assert.equal(message.nickname, "Mina");
  assert.equal(message.canDelete, false);
  assert.equal(message.isEdited, true);
  assert.equal(message.avatar.dataUri, createPixelAvatar("author-bucket").dataUri);
});
