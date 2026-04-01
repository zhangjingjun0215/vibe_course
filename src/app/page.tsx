"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { PixelAvatar } from "@/components/pixel-avatar";
import {
  MAX_MESSAGE_LENGTH,
  MAX_NICKNAME_LENGTH,
  type PublicMessage,
  type Viewer,
} from "@/lib/board";

type BoardPayload = {
  adminConfigured?: boolean;
  data?: PublicMessage[];
  error?: string;
  missing?: string[];
  viewer?: Viewer;
};

type MessageMutationPayload = {
  data?: PublicMessage;
  error?: string;
  retryAfterSeconds?: number;
  viewer?: Viewer;
  warning?: string;
};

type AdminSessionPayload = {
  error?: string;
  message?: string;
  missing?: string[];
  viewer?: Viewer;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const boardHighlights = [
  "Nickname is required for every note.",
  "Pixel avatars stay stable per anonymous source.",
  "Basic rate limits are enforced on the server.",
];

async function fetchBoardPayload() {
  const response = await fetch("/api/messages", { cache: "no-store" });
  const payload = (await response.json()) as BoardPayload;

  return { payload, response };
}

function noteRotation(index: number) {
  const pattern = [-0.7, 0.45, -0.25, 0.3];

  return `${pattern[index % pattern.length]}deg`;
}

export default function Home() {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const statusLabel = isLoading
    ? "Loading"
    : missingVariables.length > 0
      ? "Setup required"
      : viewer?.isAdmin
        ? "Admin mode"
        : "Public board";

  async function loadBoard() {
    try {
      const { payload, response } = await fetchBoardPayload();

      if (!response.ok) {
        setMessages([]);
        setViewer(null);
        setMissingVariables(payload.missing ?? []);
        setAdminConfigured(false);
        setErrorMessage(payload.error ?? "Failed to load the guestbook.");
        return;
      }

      setMessages(payload.data ?? []);
      setViewer(payload.viewer ?? { isAdmin: false, role: "guest" });
      setMissingVariables([]);
      setAdminConfigured(Boolean(payload.adminConfigured));
      setErrorMessage(null);
    } catch {
      setMessages([]);
      setViewer(null);
      setMissingVariables([]);
      setAdminConfigured(false);
      setErrorMessage("Failed to reach the guestbook API.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  async function handleAdminSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSigningIn || adminPasswordInput.trim().length === 0) {
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch("/api/admin/session", {
        body: JSON.stringify({ password: adminPasswordInput }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as AdminSessionPayload;

      if (!response.ok) {
        setMissingVariables(payload.missing ?? []);
        setErrorMessage(payload.error ?? "Failed to enter admin mode.");
        return;
      }

      setViewer(payload.viewer ?? { isAdmin: true, role: "admin" });
      setAdminPasswordInput("");
      setNoticeMessage(payload.message ?? "Admin mode enabled.");
      await loadBoard();
    } catch {
      setErrorMessage("Failed to enter admin mode.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "DELETE",
      });
      const payload = (await response.json()) as AdminSessionPayload;

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to leave admin mode.");
        return;
      }

      setViewer(payload.viewer ?? { isAdmin: false, role: "guest" });
      setNoticeMessage(payload.message ?? "Admin mode cleared.");
      await loadBoard();
    } catch {
      setErrorMessage("Failed to leave admin mode.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleCreateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nickname = nicknameInput.trim();
    const content = messageInput.trim();

    if (!nickname || !content || isSubmitting || missingVariables.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch("/api/messages", {
        body: JSON.stringify({ content, nickname }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as MessageMutationPayload;

      if (!response.ok) {
        const retryHint =
          payload.retryAfterSeconds && response.status === 429
            ? ` Retry in about ${payload.retryAfterSeconds} seconds.`
            : "";

        setErrorMessage((payload.error ?? "Failed to submit your note.") + retryHint);
        return;
      }

      if (payload.data) {
        setMessages((currentMessages) => [payload.data as PublicMessage, ...currentMessages]);
      }

      setMessageInput("");
      setNoticeMessage(payload.warning ?? "Note pinned to the board.");
      setViewer(payload.viewer ?? viewer);
    } catch {
      setErrorMessage("Failed to submit your note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMessage(messageId: number) {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm("Delete this note from the public board?");

    if (!confirmed) {
      return;
    }

    setDeletingId(messageId);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as MessageMutationPayload;

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to delete the note.");
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId)
      );
      setNoticeMessage(payload.warning ?? "Note removed from the board.");
    } catch {
      setErrorMessage("Failed to delete the note.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="flex h-full flex-col gap-5 rounded-[36px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,252,247,0.94),rgba(250,240,225,0.96))] p-5 shadow-[0_36px_120px_rgba(54,31,18,0.16)] sm:p-6">
            <section className="rounded-[30px] border border-black/6 bg-stone-950 px-5 py-5 text-stone-50 shadow-[0_26px_80px_rgba(30,21,15,0.28)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-stone-300">
                    Field Notes
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-stone-200">
                    {statusLabel}
                  </span>
                </div>
                <div className="space-y-3">
                  <h1 className="font-[family:var(--font-newsreader)] text-4xl leading-none tracking-tight text-stone-50 sm:text-[3.3rem]">
                    Leave a note. Keep the archive alive.
                  </h1>
                  <p className="text-sm leading-6 text-stone-300">
                    Every message gets a required nickname, a stable pixel avatar,
                    and a public spot on the board. Moderator controls stay private
                    to one password-protected session.
                  </p>
                </div>
                <div className="grid gap-2">
                  {boardHighlights.map((highlight) => (
                    <div
                      className="rounded-[20px] border border-white/10 bg-white/7 px-4 py-3 text-sm leading-6 text-stone-200"
                      key={highlight}
                    >
                      {highlight}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-black/6 bg-white/86 px-5 py-5 shadow-[0_20px_70px_rgba(55,33,20,0.08)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-700">
                    Compose
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                    Pin a fresh note
                  </h2>
                </div>
                <div className="rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                  {messages.length} notes
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleCreateMessage}>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-stone-800">
                    Nickname
                  </span>
                  <input
                    className="w-full rounded-[20px] border border-black/8 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white"
                    maxLength={MAX_NICKNAME_LENGTH}
                    onChange={(event) => setNicknameInput(event.target.value)}
                    placeholder="Required, visible on the board"
                    required
                    type="text"
                    value={nicknameInput}
                  />
                  <span className="text-xs text-stone-500">
                    Up to {MAX_NICKNAME_LENGTH} characters.
                  </span>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-stone-800">
                    Message
                  </span>
                  <textarea
                    className="min-h-40 w-full rounded-[24px] border border-black/8 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white"
                    maxLength={MAX_MESSAGE_LENGTH}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder="Write something future visitors should find here."
                    required
                    value={messageInput}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
                    <span>20 seconds between posts, up to 8 notes per hour.</span>
                    <span>{messageInput.length}/{MAX_MESSAGE_LENGTH}</span>
                  </div>
                </label>

                <button
                  className="inline-flex w-full items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                  disabled={isSubmitting || missingVariables.length > 0}
                  type="submit"
                >
                  {isSubmitting ? "Pinning note..." : "Publish note"}
                </button>
              </form>
            </section>

            <section className="rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,245,240,0.92))] px-5 py-5 shadow-[0_20px_70px_rgba(55,33,20,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-stone-500">
                    Moderator
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                    Private controls
                  </h2>
                </div>
                {viewer?.isAdmin ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Active
                  </span>
                ) : null}
              </div>

              {viewer?.isAdmin ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-stone-600">
                    This browser session can delete public notes and open the admin
                    desk for search and bulk moderation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                      href="/admin"
                    >
                      Open admin desk
                    </Link>
                    <button
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                      disabled={isSigningOut}
                      onClick={handleSignOut}
                      type="button"
                    >
                      {isSigningOut ? "Leaving..." : "Leave admin mode"}
                    </button>
                  </div>
                </div>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleAdminSignIn}>
                  <p className="text-sm leading-6 text-stone-600">
                    Only the moderator password unlocks delete controls and the admin
                    desk. Public visitors never need to sign in.
                  </p>
                  <input
                    className="w-full rounded-[20px] border border-black/8 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-950 focus:bg-white"
                    onChange={(event) => setAdminPasswordInput(event.target.value)}
                    placeholder="Moderator password"
                    type="password"
                    value={adminPasswordInput}
                  />
                  <button
                    className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      isSigningIn ||
                      adminPasswordInput.trim().length === 0 ||
                      !adminConfigured
                    }
                    type="submit"
                  >
                    {isSigningIn ? "Entering..." : "Enter admin mode"}
                  </button>
                  {!adminConfigured ? (
                    <p className="text-xs leading-5 text-stone-500">
                      Admin mode will unlock after the server-side password and
                      secret key are configured.
                    </p>
                  ) : null}
                </form>
              )}
            </section>
          </div>
        </aside>

        <section className="grid min-w-0 gap-5">
          {errorMessage ? (
            <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/8 px-5 py-4 text-sm text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {noticeMessage ? (
            <div className="rounded-[28px] border border-emerald-500/18 bg-emerald-500/8 px-5 py-4 text-sm text-emerald-950">
              {noticeMessage}
            </div>
          ) : null}

          {missingVariables.length > 0 ? (
            <div className="rounded-[30px] border border-amber-500/16 bg-amber-50/90 px-6 py-5 text-sm leading-7 text-amber-950 shadow-[0_20px_80px_rgba(78,45,18,0.07)]">
              <p className="font-semibold">Server setup is incomplete.</p>
              <p className="mt-2">
                Add the missing environment variables, then refresh the board:
              </p>
              <p className="mt-3 font-mono text-xs leading-6 text-amber-900/85">
                {missingVariables.join(", ")}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <section className="rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(246,240,231,0.94))] p-5 shadow-[0_30px_120px_rgba(44,26,17,0.1)] sm:p-6">
              <div className="mb-6 flex flex-col gap-4 border-b border-black/6 pb-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                    Public board
                  </p>
                  <h2 className="font-[family:var(--font-newsreader)] text-4xl leading-none tracking-tight text-stone-950">
                    Recent notes from the archive
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-stone-600">
                    Nicknames are visible, avatars stay stable for the same source,
                    and only the moderator can remove notes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                    {messages.length} visible notes
                  </span>
                  <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                    Anonymous posting
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-5 py-6 text-sm text-stone-500">
                  Loading the latest notes...
                </div>
              ) : null}

              {!isLoading && messages.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-5 py-6 text-sm leading-7 text-stone-500">
                  No notes yet. Be the first visitor to leave one.
                </div>
              ) : null}

              {!isLoading && messages.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {messages.map((message, index) => (
                    <article
                      className="group relative overflow-hidden rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,243,236,0.98))] p-5 shadow-[0_24px_80px_rgba(52,31,20,0.08)] transition hover:-translate-y-1"
                      key={message.id}
                      style={{ transform: `rotate(${noteRotation(index)})` }}
                    >
                      <span className="absolute right-4 top-4 h-12 w-12 rounded-full bg-[radial-gradient(circle,rgba(217,119,6,0.24),transparent_68%)] blur-xl" />
                      <div className="relative flex h-full flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <PixelAvatar
                              alt={`${message.nickname} avatar`}
                              backgroundColor={message.avatar.backgroundColor}
                              className="h-14 w-14 shrink-0"
                              src={message.avatar.dataUri}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-stone-950">
                                {message.nickname}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                                {dateFormatter.format(new Date(message.createdAt))}
                              </p>
                            </div>
                          </div>

                          {message.canDelete ? (
                            <button
                              className="rounded-full border border-rose-300 bg-white/90 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={deletingId === message.id}
                              onClick={() => handleDeleteMessage(message.id)}
                              type="button"
                            >
                              {deletingId === message.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-7 text-stone-800">
                          {message.content}
                        </p>

                        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                          <span className="rounded-full border border-black/8 bg-white/90 px-3 py-1 text-xs font-medium text-stone-600">
                            Note #{message.id}
                          </span>
                          {message.isEdited ? (
                            <span className="rounded-full border border-black/8 bg-white/90 px-3 py-1 text-xs font-medium text-stone-600">
                              Edited {dateFormatter.format(new Date(message.updatedAt))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[30px] border border-black/6 bg-white/82 p-5 shadow-[0_24px_100px_rgba(42,22,15,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Board rules
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
                  <p>Nicknames are required, but they do not create accounts.</p>
                  <p>Each anonymous source keeps the same pixel avatar over time.</p>
                  <p>Delete controls appear only while admin mode is active.</p>
                </div>
              </section>

              <section className="rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,rgba(43,25,17,0.98),rgba(86,52,29,0.98))] p-5 text-stone-50 shadow-[0_24px_100px_rgba(42,22,15,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Moderation path
                </p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-stone-200">
                  <p>Open admin mode from the compose rail to reveal delete controls.</p>
                  <p>Use the admin desk for search, bulk delete, and moderation stats.</p>
                  <p>Every delete action is recorded in the server-side moderation log.</p>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
