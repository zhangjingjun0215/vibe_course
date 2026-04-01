"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { PixelAvatar } from "@/components/pixel-avatar";
import {
  matchesAdminSearch,
  normalizeSearchQuery,
  type AdminMessage,
  type Viewer,
} from "@/lib/board";

type AdminPayload = {
  data?: AdminMessage[];
  error?: string;
  viewer?: Viewer;
};

type DeletePayload = {
  deletedIds?: number[];
  error?: string;
  message?: string;
  viewer?: Viewer;
  warning?: string;
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

function uniqueSourceCount(messages: AdminMessage[]) {
  return new Set(messages.map((message) => message.sourceBucket)).size;
}

export default function AdminPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const deferredSearch = useDeferredValue(searchInput);

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
      setErrorMessage(null);
      setNoticeMessage(null);
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

  const visibleMessages = useMemo(() => {
    const query = normalizeSearchQuery(deferredSearch);

    return messages.filter((message) => matchesAdminSearch(message, query));
  }, [deferredSearch, messages]);

  const visibleIds = visibleMessages.map((message) => message.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((messageId) => selectedIds.includes(messageId));
  const totalMessages = messages.length;
  const totalSourceBuckets = uniqueSourceCount(messages);
  const selectedVisibleCount = visibleIds.filter((messageId) =>
    selectedIds.includes(messageId)
  ).length;
  const canModerate = viewer?.isAdmin ?? false;

  function removeMessagesFromState(deletedIds: number[]) {
    if (deletedIds.length === 0) {
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.filter((message) => !deletedIds.includes(message.id))
    );
    setSelectedIds((currentSelectedIds) =>
      currentSelectedIds.filter((messageId) => !deletedIds.includes(messageId))
    );
  }

  function toggleSelection(messageId: number) {
    setSelectedIds((currentSelectedIds) =>
      currentSelectedIds.includes(messageId)
        ? currentSelectedIds.filter((selectedId) => selectedId !== messageId)
        : [...currentSelectedIds, messageId]
    );
  }

  function toggleVisibleSelection() {
    if (visibleIds.length === 0) {
      return;
    }

    setSelectedIds((currentSelectedIds) => {
      if (allVisibleSelected) {
        return currentSelectedIds.filter((messageId) => !visibleIds.includes(messageId));
      }

      return [...new Set([...currentSelectedIds, ...visibleIds])];
    });
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
      const payload = (await response.json()) as DeletePayload;

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to delete the message.");
        return;
      }

      removeMessagesFromState(payload.deletedIds ?? [messageId]);
      setNoticeMessage(payload.warning ?? "Note deleted.");
    } catch {
      setErrorMessage("Failed to delete the message.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (isBulkDeleting || selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected note${selectedIds.length === 1 ? "" : "s"} from the public board?`
    );

    if (!confirmed) {
      return;
    }

    setIsBulkDeleting(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch("/api/admin/messages", {
        body: JSON.stringify({ ids: selectedIds }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = (await response.json()) as DeletePayload;

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to delete the selected messages.");
        return;
      }

      removeMessagesFromState(payload.deletedIds ?? []);
      setNoticeMessage(payload.warning ?? payload.message ?? "Selected notes deleted.");
    } catch {
      setErrorMessage("Failed to delete the selected messages.");
    } finally {
      setIsBulkDeleting(false);
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
      setSelectedIds([]);
      setNoticeMessage(payload.message ?? "Admin mode cleared.");
    } catch {
      setErrorMessage("Failed to leave admin mode.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-6">
        <header className="rounded-[36px] border border-black/6 bg-[linear-gradient(180deg,rgba(24,19,16,0.98),rgba(63,38,27,0.98))] px-6 py-6 text-stone-50 shadow-[0_32px_120px_rgba(30,21,15,0.28)] sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">
                Admin desk
              </p>
              <h1 className="font-[family:var(--font-newsreader)] text-5xl leading-none tracking-tight text-stone-50">
                Search the archive. Prune it in batches.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300">
                The public board stays anonymous; the desk is where the moderator
                can search by nickname or content, select visible notes, and delete
                them with one session.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-full border border-white/14 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-white/8"
                href="/"
              >
                Back to public board
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

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-[26px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Total notes
              </p>
              <p className="mt-3 text-3xl font-semibold">{totalMessages}</p>
            </article>
            <article className="rounded-[26px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Source buckets
              </p>
              <p className="mt-3 text-3xl font-semibold">{totalSourceBuckets}</p>
            </article>
            <article className="rounded-[26px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Visible results
              </p>
              <p className="mt-3 text-3xl font-semibold">{visibleMessages.length}</p>
            </article>
            <article className="rounded-[26px] border border-white/10 bg-white/6 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                Selected
              </p>
              <p className="mt-3 text-3xl font-semibold">{selectedIds.length}</p>
            </article>
          </div>
        </header>

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

        {!isLoading && !canModerate ? (
          <section className="rounded-[32px] border border-black/6 bg-white/82 px-6 py-6 text-stone-800 shadow-[0_24px_90px_rgba(42,23,15,0.08)]">
            <p className="text-lg font-semibold">This desk is reserved for the admin session.</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Go back to the public board, enter the moderator password, then reopen
              this page.
            </p>
          </section>
        ) : null}

        {canModerate ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,235,0.96))] p-5 shadow-[0_30px_120px_rgba(42,23,15,0.08)] sm:p-6">
              <div className="mb-5 flex flex-col gap-4 border-b border-black/6 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <label className="grid flex-1 gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                    Search
                  </span>
                  <input
                    className="w-full rounded-[22px] border border-black/8 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-950"
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search nickname, content, or source bucket"
                    type="search"
                    value={searchInput}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={visibleMessages.length === 0}
                    onClick={toggleVisibleSelection}
                    type="button"
                  >
                    {allVisibleSelected ? "Clear visible" : `Select visible (${visibleMessages.length})`}
                  </button>
                  <button
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={selectedIds.length === 0}
                    onClick={() => setSelectedIds([])}
                    type="button"
                  >
                    Clear selection
                  </button>
                  <button
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                    disabled={selectedIds.length === 0 || isBulkDeleting}
                    onClick={handleBulkDelete}
                    type="button"
                  >
                    {isBulkDeleting
                      ? "Deleting..."
                      : `Delete selected (${selectedIds.length})`}
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                  Loading moderation queue...
                </div>
              ) : null}

              {!isLoading && messages.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                  No notes are currently stored on the board.
                </div>
              ) : null}

              {!isLoading && messages.length > 0 && visibleMessages.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/12 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                  No notes match the current search query.
                </div>
              ) : null}

              {!isLoading && visibleMessages.length > 0 ? (
                <div className="grid gap-4">
                  {visibleMessages.map((message) => {
                    const isSelected = selectedIds.includes(message.id);

                    return (
                      <article
                        className="rounded-[30px] border border-black/6 bg-white/88 px-5 py-5 shadow-[0_20px_70px_rgba(52,33,21,0.05)]"
                        key={message.id}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 items-start gap-4">
                              <label className="mt-2 inline-flex shrink-0 items-center">
                                <input
                                  checked={isSelected}
                                  className="h-4 w-4 rounded border-black/20 text-stone-950 focus:ring-stone-500"
                                  onChange={() => toggleSelection(message.id)}
                                  type="checkbox"
                                />
                              </label>
                              <PixelAvatar
                                alt={`${message.nickname} avatar`}
                                backgroundColor={message.avatar.backgroundColor}
                                className="h-14 w-14 shrink-0"
                                src={message.avatar.dataUri}
                              />
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-stone-950">
                                    {message.nickname}
                                  </p>
                                  <span className="rounded-full border border-black/8 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                                    #{message.id}
                                  </span>
                                  <span className="rounded-full border border-black/8 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                                    {message.sourceBucket}
                                  </span>
                                  {message.isEdited ? (
                                    <span className="rounded-full border border-black/8 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                                      Edited
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                                  {dateFormatter.format(new Date(message.createdAt))}
                                </p>
                              </div>
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
                    );
                  })}
                </div>
              ) : null}
            </section>

            <aside className="grid gap-5 self-start">
              <section className="rounded-[30px] border border-black/6 bg-white/84 p-5 shadow-[0_24px_80px_rgba(42,23,15,0.07)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Selection
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
                  <p>{selectedIds.length} notes selected in total.</p>
                  <p>{selectedVisibleCount} selected notes are in the current filtered view.</p>
                  <p>Bulk delete writes one moderation log row per removed note.</p>
                </div>
              </section>

              <section className="rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,248,238,0.96),rgba(247,235,218,0.96))] p-5 shadow-[0_24px_80px_rgba(42,23,15,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                  Search scope
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
                  <p>The search bar checks nickname, note content, and source bucket text.</p>
                  <p>Visible selection follows the current search results, not the full archive.</p>
                  <p>Clear the search field to return to the full moderation queue.</p>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
