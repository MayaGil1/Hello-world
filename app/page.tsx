import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getSession } from "@/lib/auth";
import { getMyVotes, POST_SELECT, sortCaptions, type Post } from "@/lib/feed";
import { themeForDate } from "@/lib/themes";

const TABS = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
] as const;
type Sort = (typeof TABS)[number]["key"];

const DAY = 24 * 60 * 60 * 1000;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: rawSort } = await searchParams;
  const sort: Sort = TABS.some((t) => t.key === rawSort) ? (rawSort as Sort) : "hot";
  const { supabase, user, profile } = await getSession();
  const theme = themeForDate();

  let query = supabase.from("posts").select(POST_SELECT);
  if (sort === "top") {
    query = query
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
  } else {
    query = query.order("created_at", { ascending: false }).limit(sort === "hot" ? 100 : 30);
  }
  const { data } = await query;
  let posts = (data ?? []) as Post[];

  if (sort === "hot") {
    // Hot: votes count for more on fresh posts, so new photos can compete but the feed is never empty.
    const hotness = (p: Post) =>
      (p.score + 1) / Math.pow((Date.now() - new Date(p.created_at).getTime()) / 3_600_000 + 2, 1.5);
    posts = posts.sort((a, b) => hotness(b) - hotness(a)).slice(0, 30);
  }

  // Yesterday's best caption, so there's always something to come back and check.
  const { data: winnerRows } = await supabase
    .from("captions")
    .select("text, score, post_id, posts!inner(image_url, created_at)")
    .gte("posts.created_at", new Date(Date.now() - 2 * DAY).toISOString())
    .lt("posts.created_at", new Date(Date.now() - DAY).toISOString())
    .gt("score", 0)
    .order("score", { ascending: false })
    .limit(1);
  const winner = winnerRows?.[0] as
    | { text: string; score: number; post_id: number; posts: { image_url: string } }
    | undefined;

  const myVotes = await getMyVotes(
    supabase,
    user?.id,
    posts.flatMap((p) => sortCaptions(p.captions).slice(0, 3).map((c) => c.id)),
  );

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 p-5 text-white">
        <p className="text-sm font-medium opacity-90">Today&apos;s theme</p>
        <h1 className="mt-1 text-2xl font-semibold">{theme}</h1>
        <p className="mt-2 text-sm opacity-90">
          {user
            ? `Hey ${profile?.first_name ?? "there"} — post a photo, let AI caption it, and vote on the best lines.`
            : "Post a photo, let AI caption it, and vote on the funniest line. New theme every day."}
        </p>
        <Link
          href={user ? "/create" : "/login"}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-zinc-100"
        >
          {user ? "Post a photo" : "Sign in to play"}
        </Link>
      </section>

      {!user && (
        <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
          {[
            ["📸", "Snap something", "Campus, subway, your dorm"],
            ["✨", "AI writes 5 captions", "Each in a different style"],
            ["🗳️", "Everyone votes", "Funniest line wins the day"],
          ].map(([icon, title, detail]) => (
            <li
              key={title}
              className="rounded-xl border border-black/[.08] bg-white px-2 py-3 dark:border-white/[.145] dark:bg-zinc-900"
            >
              <div className="text-xl" aria-hidden>
                {icon}
              </div>
              <p className="mt-1 font-semibold text-black dark:text-zinc-50">{title}</p>
              <p className="mt-0.5 leading-snug">{detail}</p>
            </li>
          ))}
        </ol>
      )}

      {winner && (
        <Link
          href={`/p/${winner.post_id}`}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-black/[.08] bg-white p-3 hover:border-black/[.2] dark:border-white/[.145] dark:bg-zinc-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={winner.posts.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-orange-600">🏆 Yesterday&apos;s top caption · {winner.score} pts</p>
            <p className="truncate text-sm text-black dark:text-zinc-50">{winner.text}</p>
          </div>
        </Link>
      )}

      <nav className="mt-6 flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "hot" ? "/" : `/?sort=${tab.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              sort === tab.key
                ? "bg-foreground text-background"
                : "text-zinc-600 hover:bg-black/[.05] dark:text-zinc-400 dark:hover:bg-white/[.08]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-6">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[.15] p-8 text-center text-zinc-600 dark:border-white/[.2] dark:text-zinc-400">
            Nothing here yet. {user ? <Link href="/create" className="font-medium underline">Be the first to post.</Link> : "Sign in and be the first to post."}
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              myVotes={myVotes}
              signedIn={!!user}
              isMine={user?.id === post.user_id}
              limit={3}
            />
          ))
        )}
      </div>
    </main>
  );
}
