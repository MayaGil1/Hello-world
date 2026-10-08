"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { vote } from "@/app/actions/vote";

type Props = {
  captionId: number;
  score: number;
  myVote: 1 | -1 | 0;
  signedIn: boolean;
};

export default function VoteButtons({ captionId, score, myVote, signedIn }: Props) {
  const [current, setCurrent] = useState(myVote);
  const [shownScore, setShownScore] = useState(score);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href="/login"
        title="Sign in to vote"
        className="flex shrink-0 flex-col items-center rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
      >
        <span aria-hidden>▲</span>
        <span className="font-semibold tabular-nums">{score}</span>
        <span className="sr-only">Sign in to vote</span>
      </Link>
    );
  }

  function cast(value: 1 | -1) {
    const next = current === value ? 0 : value; // clicking the same arrow again removes the vote
    const previous = current;
    setCurrent(next);
    setShownScore((s) => s - previous + next);
    setError(null);
    startTransition(async () => {
      const result = await vote(captionId, next);
      if (result.error) {
        setCurrent(previous);
        setShownScore((s) => s - next + previous);
        setError(result.error);
      }
    });
  }

  const base =
    "flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-60";

  return (
    <div className="flex shrink-0 flex-col items-center" title={error ?? undefined}>
      <button
        onClick={() => cast(1)}
        disabled={pending}
        aria-label="Upvote"
        aria-pressed={current === 1}
        className={`${base} ${current === 1 ? "bg-orange-500 text-white" : "text-zinc-500 hover:bg-black/[.06] dark:hover:bg-white/[.08]"}`}
      >
        ▲
      </button>
      <span
        className={`text-sm font-semibold tabular-nums ${current === 1 ? "text-orange-600" : current === -1 ? "text-indigo-600" : "text-zinc-700 dark:text-zinc-300"}`}
      >
        {shownScore}
      </span>
      <button
        onClick={() => cast(-1)}
        disabled={pending}
        aria-label="Downvote"
        aria-pressed={current === -1}
        className={`${base} ${current === -1 ? "bg-indigo-500 text-white" : "text-zinc-500 hover:bg-black/[.06] dark:hover:bg-white/[.08]"}`}
      >
        ▼
      </button>
      {error && <span className="sr-only">{error}</span>}
    </div>
  );
}
