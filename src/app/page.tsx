"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  MAX_MESSAGE_LENGTH,
  type PublicMessage,
  type Viewer,
} from "@/lib/board";

type BoardPayload = {
  adminConfigured?: boolean;
  data?: PublicMessage[];
  error?: string;
  missing?: string[];
  retryAfterSeconds?: number;
  viewer?: Viewer;
};

type MessageMutationPayload = {
  data?: PublicMessage;
  error?: string;
  message?: string;
  retryAfterSeconds?: number;
  viewer?: Viewer;
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

async function fetchBoardPayload() {
  const response = await fetch("/api/messages", { cache: "no-store" });
  const payload = (await response.json()) as BoardPayload;

  return { payload, response };
}

export default function Home() {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
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
        : "Public mode";

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

    const content = messageInput.trim();

    if (!content || isSubmitting || missingVariables.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch("/api/messages", {
        body: JSON.stringify({ content }),
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

        setErrorMessage((payload.error ?? "Failed to submit your message.") + retryHint);
        return;
      }

      if (payload.data) {
        const nextMessage = payload.data;

        setMessages((currentMessages) => [nextMessage, ...currentMessages]);
      }

      setMessageInput("");
      setNoticeMessage("Message published.");
      setViewer(payload.viewer ?? viewer);
    } catch {
      setErrorMessage("Failed to submit your message.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMessage(messageId: number) {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm("Delete this message from the board?");

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
        setErrorMessage(payload.error ?? "Failed to delete the message.");
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId)
      );
      setNoticeMessage("Message deleted.");
    } catch {
      setErrorMessage("Failed to delete the message.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[32px] border border-black/6 bg-white/78 px-6 py-6 shadow-[0_30px_120px_rgba(34,25,19,0.09)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-700">
              Next.js 16 + Supabase
            </p>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                Anonymous guestbook in public, moderator controls in private.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-stone-600">
                Anyone can leave a note. The board only distinguishes the moderator
                from everyone else, which keeps the workflow reliable without email
                sign-in.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[28px] bg-stone-950 px-5 py-5 text-stone-50 sm:min-w-[320px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.26em] text-stone-400">
                Status
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-stone-200">
                {statusLabel}
              </span>
            </div>
            {viewer?.isAdmin ? (
              <div className="space-y-3">
                <p className="text-sm leading-6 text-stone-300">
                  Moderator controls are active in this browser session.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-full border border-white/14 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-white/8"
                    href="/admin"
                  >
                    Open admin desk
                  </Link>
                  <button
                    className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                    disabled={isSigningOut}
                    onClick={handleSignOut}
                    type="button"
                  >
                    {isSigningOut ? "Leaving..." : "Leave admin mode"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-stone-300">
                Public posting is open. Moderator access is controlled by a private
                password and a server-only Supabase key.
              </p>
            )}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[34px] border border-black/6 bg-[linear-gradient(145deg,#221d18,#4b2d20_60%,#d97706_160%)] px-6 py-6 text-stone-50 shadow-[0_26px_90px_rgba(64,36,19,0.26)] sm:px-8 sm:py-8">
            <div className="flex flex-col gap-8">
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-300">
                    Public board
                  </p>
                  <p className="mt-3 text-sm leading-6 text-stone-100">
                    The guestbook accepts anonymous posts and always stays readable.
                  </p>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-300">
                    Moderator mode
                  </p>
                  <p className="mt-3 text-sm leading-6 text-stone-100">
                    One server-side password unlocks deletion controls and the admin desk.
                  </p>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-300">
                    Rate limits
                  </p>
                  <p className="mt-3 text-sm leading-6 text-stone-100">
                    Posting is throttled by a request fingerprint to slow down spam bursts.
                  </p>
                </article>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <article className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                    Live counts
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-black/18 px-4 py-4">
                      <p className="text-3xl font-semibold">{messages.length}</p>
                      <p className="mt-1 text-sm text-stone-300">messages on the public board</p>
                    </div>
                    <div className="rounded-3xl bg-black/18 px-4 py-4">
                      <p className="text-3xl font-semibold">{viewer?.isAdmin ? "1" : "0"}</p>
                      <p className="mt-1 text-sm text-stone-300">moderator sessions in this browser</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-white/10 bg-stone-950/54 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                    Guardrails
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-200">
                    <li>One new post every 20 seconds per request fingerprint.</li>
                    <li>At most 8 posts in a rolling hour.</li>
                    <li>Only the moderator session can delete messages.</li>
                  </ul>
                </article>
              </div>
            </div>
          </div>

          <aside className="grid gap-6">
            <section className="rounded-[34px] border border-black/6 bg-white/82 px-6 py-6 shadow-[0_24px_90px_rgba(42,23,15,0.08)] backdrop-blur sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Moderator access
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                    Password gate
                  </h2>
                </div>
                <span className="rounded-full border border-black/8 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                  Server-only
                </span>
              </div>

              {adminConfigured ? (
                <form className="mt-6 space-y-4" onSubmit={handleAdminSignIn}>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">
                      Admin password
                    </span>
                    <input
                      autoComplete="current-password"
                      className="w-full rounded-3xl border border-black/8 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-amber-500 focus:bg-white"
                      onChange={(event) => setAdminPasswordInput(event.target.value)}
                      placeholder="Enter the moderator password"
                      type="password"
                      value={adminPasswordInput}
                    />
                  </label>
                  <button
                    className="w-full rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                    disabled={isSigningIn || adminPasswordInput.trim().length === 0}
                    type="submit"
                  >
                    {isSigningIn ? "Entering admin mode..." : "Enter admin mode"}
                  </button>
                </form>
              ) : (
                <div className="mt-6 rounded-[28px] border border-dashed border-black/10 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
                  Admin mode is not configured in this environment yet. Add the admin
                  password and a server-side Supabase key to enable moderation.
                </div>
              )}

              <p className="mt-4 text-sm leading-6 text-stone-500">
                This route does not depend on email delivery or Supabase Auth. It only
                writes an HttpOnly cookie after the password is verified on the server.
              </p>
            </section>

            <section className="rounded-[34px] border border-black/6 bg-white/82 px-6 py-6 shadow-[0_24px_90px_rgba(42,23,15,0.08)] backdrop-blur sm:px-7">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Ops notes
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                <li>Anonymous posting means no user account friction for visitors.</li>
                <li>Moderator actions stay behind a server-side cookie.</li>
                <li>Deletion uses a server-only Supabase secret or service-role key.</li>
                <li>The board remains useful even if admin mode is not configured yet.</li>
              </ul>
            </section>
          </aside>
        </section>

        <section className="rounded-[36px] border border-black/6 bg-white/82 px-6 py-6 shadow-[0_24px_90px_rgba(42,23,15,0.08)] backdrop-blur sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Guestbook
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-950">Recent messages</h2>
            </div>
            <div className="text-sm text-stone-500">
              Anyone can post. Only the moderator can remove entries.
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCreateMessage}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">Leave a message</span>
              <textarea
                className="min-h-32 w-full rounded-[28px] border border-black/8 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-950 outline-none transition focus:border-amber-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                disabled={missingVariables.length > 0}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Write something worth keeping."
                rows={4}
                value={messageInput}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-500">
                {messageInput.trim().length}/{MAX_MESSAGE_LENGTH} characters
              </p>
              <button
                className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                disabled={
                  isSubmitting ||
                  missingVariables.length > 0 ||
                  messageInput.trim().length === 0
                }
                type="submit"
              >
                {isSubmitting ? "Publishing..." : "Publish message"}
              </button>
            </div>
          </form>

          {noticeMessage ? (
            <div className="mt-5 rounded-[28px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-4 text-sm text-emerald-900">
              {noticeMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-[28px] border border-rose-500/20 bg-rose-500/8 px-4 py-4 text-sm text-rose-900">
              <p>{errorMessage}</p>
              {missingVariables.length > 0 ? (
                <p className="mt-2 text-rose-900/75">
                  Missing configuration: {missingVariables.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4">
            {isLoading ? (
              <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                Loading messages...
              </div>
            ) : null}

            {!isLoading && messages.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm leading-6 text-stone-500">
                No messages yet. Submit the first note.
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                className="rounded-[30px] border border-black/6 bg-stone-50/80 px-5 py-5 shadow-[0_18px_60px_rgba(52,33,21,0.04)]"
                key={message.id}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-stone-900">
                        Message #{message.id}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                        {dateFormatter.format(new Date(message.createdAt))}
                        {message.isEdited ? " • edited" : ""}
                      </p>
                    </div>

                    {message.canDelete ? (
                      <button
                        className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
