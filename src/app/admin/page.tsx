"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { type AdminMessage, type Viewer } from "@/lib/board";

type AdminPayload = {
  data?: AdminMessage[];
  error?: string;
  stats?: {
    totalMessages: number;
    totalSourceBuckets: number;
  };
  viewer?: Viewer;
};

type AdminSessionPayload = {
  error?: string;
  message?: string;
  viewer?: Viewer;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

async function fetchAdminPayload() {
  const response = await fetch("/api/admin/messages", { cache: "no-store" });
  const payload = (await response.json()) as AdminPayload;

  return { payload, response };
}

export default function AdminPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalSourceBuckets: 0,
  });

  async function loadDashboard() {
    try {
      const { payload, response } = await fetchAdminPayload();

      if (!response.ok) {
        setMessages([]);
        setViewer(payload.viewer ?? { isAdmin: false, role: "guest" });
        setErrorMessage(payload.error ?? "Failed to load moderation data.");
        return;
      }

      setMessages(payload.data ?? []);
      setViewer(payload.viewer ?? { isAdmin: false, role: "guest" });
      setStats(
        payload.stats ?? {
          totalMessages: 0,
          totalSourceBuckets: 0,
        }
      );
      setErrorMessage(null);
    } catch {
      setMessages([]);
      setViewer(null);
      setErrorMessage("Failed to reach the moderation API.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleDeleteMessage(messageId: number) {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm("Delete this message from the public board?");

    if (!confirmed) {
      return;
    }

    setDeletingId(messageId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to delete the message.");
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId)
      );
      setStats((currentStats) => ({
        ...currentStats,
        totalMessages: Math.max(0, currentStats.totalMessages - 1),
      }));
    } catch {
      setErrorMessage("Failed to delete the message.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

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
      setMessages([]);
    } catch {
      setErrorMessage("Failed to leave admin mode.");
    } finally {
      setIsSigningOut(false);
    }
  }

  const canModerate = viewer?.isAdmin ?? false;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[32px] border border-black/6 bg-stone-950 px-6 py-6 text-stone-50 shadow-[0_26px_90px_rgba(30,21,15,0.24)] sm:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">
                Admin desk
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                Moderate the anonymous board from one place.
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex rounded-full border border-white/14 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-white/8"
                href="/"
              >
                Back to the public board
              </Link>
              {canModerate ? (
                <button
                  className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  type="button"
                >
                  {isSigningOut ? "Leaving..." : "Leave admin mode"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Messages in view
              </p>
              <p className="mt-3 text-3xl font-semibold">{stats.totalMessages}</p>
            </article>
            <article className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Source buckets
              </p>
              <p className="mt-3 text-3xl font-semibold">{stats.totalSourceBuckets}</p>
            </article>
            <article className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Viewer
              </p>
              <p className="mt-3 text-lg font-semibold">
                {canModerate ? "Admin mode active" : "Guest session"}
              </p>
            </article>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/8 px-5 py-4 text-sm text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !canModerate ? (
          <section className="rounded-[32px] border border-black/6 bg-white/82 px-6 py-6 text-stone-800 shadow-[0_24px_90px_rgba(42,23,15,0.08)]">
            <p className="text-lg font-semibold">This page is reserved for the admin session.</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Go back to the public board, enter the moderator password, then reopen
              this page.
            </p>
          </section>
        ) : null}

        {canModerate ? (
          <section className="rounded-[32px] border border-black/6 bg-white/82 px-6 py-6 shadow-[0_24px_90px_rgba(42,23,15,0.08)]">
            <div className="grid gap-4">
              {isLoading ? (
                <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                  Loading moderation queue...
                </div>
              ) : null}

              {!isLoading && messages.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                  No messages to moderate.
                </div>
              ) : null}

              {messages.map((message) => (
                <article
                  className="rounded-[30px] border border-black/6 bg-stone-50/80 px-5 py-5 shadow-[0_18px_60px_rgba(52,33,21,0.04)]"
                  key={message.id}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-stone-900">
                            Message #{message.id}
                          </p>
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                            Source {message.sourceBucket}
                          </span>
                        </div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                          {dateFormatter.format(new Date(message.createdAt))}
                        </p>
                      </div>

                      <button
                        className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletingId === message.id}
                        onClick={() => handleDeleteMessage(message.id)}
                        type="button"
                      >
                        {deletingId === message.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-7 text-stone-800">
                      {message.content}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
