"use client";

import { FormEvent, useEffect, useState } from "react";

type MessageRecord = {
  id: number | string;
  content: string;
  created_at: string;
};

type MessagesApiPayload = {
  data?: MessageRecord[];
  error?: string;
  missing?: string[];
};

type MessageApiPayload = {
  data?: MessageRecord;
  error?: string;
  missing?: string[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function Home() {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const statusLabel = isLoading
    ? "Checking..."
    : missingVariables.length > 0
      ? "Setup required"
      : "Ready";

  useEffect(() => {
    let isCancelled = false;

    async function loadMessages() {
      try {
        const response = await fetch("/api/messages", { cache: "no-store" });
        const payload = (await response.json()) as MessagesApiPayload;

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setMessages([]);
          setMissingVariables(payload.missing ?? []);
          setErrorMessage(payload.error ?? "Failed to load messages.");
          return;
        }

        setMessages(payload.data ?? []);
        setMissingVariables([]);
        setErrorMessage(null);
      } catch {
        if (!isCancelled) {
          setMessages([]);
          setMissingVariables([]);
          setErrorMessage("Failed to reach the messages API.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMessages();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedValue = inputValue.trim();

    if (!trimmedValue || isSubmitting || missingVariables.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmedValue }),
      });

      const payload = (await response.json()) as MessageApiPayload;

      if (!response.ok) {
        setMissingVariables(payload.missing ?? []);
        setErrorMessage(payload.error ?? "Failed to submit your message.");
        return;
      }

      if (payload.data) {
        setMessages((currentMessages) => [payload.data!, ...currentMessages]);
      }

      setInputValue("");
    } catch {
      setErrorMessage("Failed to submit your message.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 items-center px-6 py-12 sm:px-10 lg:px-12">
      <section className="grid w-full gap-8 rounded-[32px] border border-black/8 bg-white/88 p-8 shadow-[0_24px_100px_rgba(15,23,42,0.12)] backdrop-blur sm:p-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-8">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
              Next.js 16 + Supabase
            </p>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                Minimal full-stack message board
              </h1>
              <p className="max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                This worktree now contains a minimal App Router project with a
                single API route backed by Supabase. Add your environment
                variables, create the <code>messages</code> table, and the page
                is ready to run.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-black/6 bg-amber-50 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                Front end
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                A client component handles loading, form submission, and error
                states.
              </p>
            </article>
            <article className="rounded-3xl border border-black/6 bg-sky-50 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                API route
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                <code>/api/messages</code> exposes <code>GET</code> and{" "}
                <code>POST</code> handlers inside the App Router.
              </p>
            </article>
            <article className="rounded-3xl border border-black/6 bg-emerald-50 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Database
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                Supabase stores messages in PostgreSQL and returns the newest
                items first.
              </p>
            </article>
          </div>

          <div className="rounded-[28px] border border-black/6 bg-zinc-950 px-6 py-6 text-zinc-50">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-300">
              Setup flow
            </p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-200">
              <li>1. Copy <code>.env.example</code> to <code>.env.local</code>.</li>
              <li>2. Paste your Supabase project URL and publishable key.</li>
              <li>
                3. Run the SQL in <code>supabase/schema.sql</code> inside the
                Supabase SQL editor.
              </li>
              <li>4. Start the app with <code>npm run dev</code>.</li>
            </ol>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/8 bg-zinc-950 p-6 text-zinc-50 shadow-[0_16px_48px_rgba(15,23,42,0.28)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Live demo
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Guestbook</h2>
            </div>
            <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs font-medium text-zinc-200">
              {statusLabel}
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-200">
                Leave a message
              </span>
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                maxLength={280}
                rows={4}
                placeholder="Write something short and friendly."
                className="min-h-28 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-50 outline-none transition focus:border-amber-400 focus:bg-white/8"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                {inputValue.trim().length}/280 characters
              </p>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  isSubmitting ||
                  missingVariables.length > 0 ||
                  inputValue.trim().length === 0
                }
                className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isSubmitting ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>

          {errorMessage ? (
            <div className="mt-5 rounded-3xl border border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
              <p className="font-medium">{errorMessage}</p>
              {missingVariables.length > 0 ? (
                <p className="mt-2 text-rose-100/80">
                  Missing configuration: {missingVariables.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Recent messages
              </h3>
              <span className="text-xs text-zinc-500">{messages.length} items</span>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-zinc-300">
                  Loading messages...
                </div>
              ) : null}

              {!isLoading && messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/5 px-4 py-5 text-sm leading-6 text-zinc-300">
                  No messages yet. Submit the first entry after the Supabase
                  table is ready.
                </div>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <p className="text-sm leading-6 text-zinc-100">
                    {message.content}
                  </p>
                  <p className="mt-3 text-xs text-zinc-400">
                    {dateFormatter.format(new Date(message.created_at))}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
